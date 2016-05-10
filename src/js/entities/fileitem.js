(function(window, angular, $) {
    "use strict";
    angular.module('FileManagerApp').factory('fileItem', ['$http', '$q', '$translate', 'fileManagerConfig', 'AccessControlList', 'FilesController', 'FileManagementActionTypeEnum', 'PostitsController', 'TransformsController',
        function($http, $q, $translate, fileManagerConfig, AccessControlList, FilesController, FileManagementActionTypeEnum, PostitsController, TransformsController) {

        var FileItem = function(model, path, system) {
            var rawModel = {
                name: model && model.name || '',
                path: path || [],
                type: model && model.type || 'file',
                size: model && parseInt(model.length || 0),
                date: model && model.lastModified,
                perms: new AccessControlList(model && model.permissions),
                content: model && model.content || '',
                recursive: false,
                sizeKb: function() {
                    return Math.round(this.size / 1024, 1);
                },
                fullPath: function() {
                    if (this.path.length == 1 && this.path[0] === '/'){
                        return ('/' + this.name).replace(/\/\//g, '/');
                    }
                        return ('/' + this.path.join('/') + '/' + this.name).replace(/\/\//g, '/');
                },
                crumbsPath: function(){
                    //There's the possiblitiy that this does extra replaces.
                    //TODO: Use regular expressions or return this path from the server.
                    var fullPath = this.fullPath().split('/');
                    return fullPath;
                },
                _links: model && model._links,
                system: system
            };

            this.error = '';
            this.inprocess = false;

            this.model = angular.copy(rawModel);
            this.tempModel = angular.copy(rawModel);

            function parseMySQLDate(mysqlDate) {
                var d = (mysqlDate || '').toString().split(/[- :]/);
                return new Date(d[0], d[1] - 1, d[2], d[3], d[4], d[5]);
            }
        };

        FileItem.prototype.update = function() {
            angular.extend(this.model, angular.copy(this.tempModel));
        };

        FileItem.prototype.revert = function() {
            angular.extend(this.tempModel, angular.copy(this.model));
            this.error = '';
        };

        FileItem.prototype.deferredHandler = function(data, deferred, defaultMsg) {
            if (!data || typeof data !== 'object') {
                this.error = 'Bad response from the server, please check the docs';
            }
            if (data.result && data.result.error) {
                this.error = data.result.error;
            }
            if (!this.error && data.error) {
                this.error = data.error.message;
            }
            if (!this.error && defaultMsg) {
                this.error = defaultMsg;
            }
            if (this.error) {
                return deferred.reject(data);
            }
            this.update();
            return deferred.resolve(data);
        };

        FileItem.prototype.createFolder = function() {
            var self = this;
            var deferred = $q.defer();

            var action = new FileMkdirAction();
            action.setPath(self.tempModel.name);

            self.inprocess = true;
            self.error = '';
            FilesController.updateInvokeFileItemAction(action, self.tempModel.system.id, self.tempModel.path.join('/'))
                .then(function(data) {
                    self.deferredHandler(data, deferred);
                }, function(data) {
                    self.deferredHandler(data, deferred, $translate.instant('error_creating_folder'));
                })['finally'](function(data) {
                    self.inprocess = false;
                });

            //var data = {params: {
            //    mode: "addfolder",
            //    path: self.tempModel.path.join('/'),
            //    name: self.tempModel.name
            //}};

            //$http.post(fileManagerConfig.createFolderUrl, data).then(function(data) {
            //    self.deferredHandler(data, deferred);
            //}, function(data) {
            //    self.deferredHandler(data, deferred, $translate.instant('error_creating_folder'));
            //})['finally'](function(data) {
            //    self.inprocess = false;
            //});


            return deferred.promise;
        };

        FileItem.prototype.rename = function() {
            var self = this;
            var deferred = $q.defer();

            var action = new FileRenameAction();
            action.setPath(self.tempModel.name);

            self.inprocess = true;
            self.error = '';

            FilesController.updateInvokeFileItemAction(action, self.model.system.id, self.model.fullPath())
                .then(function(data) {
                    self.deferredHandler(data, deferred);
                }, function(data) {
                    self.deferredHandler(data, deferred, $translate.instant('error_renaming'));
                })['finally'](function(data) {
                    self.inprocess = false;
                });

            //var data = {params: {
            //    "mode": "rename",
            //    "path": self.model.fullPath(),
            //    "newPath": self.tempModel.fullPath()
            //}};
            //self.inprocess = true;
            //self.error = '';
            //$http.post(fileManagerConfig.renameUrl, data).then(function(data) {
            //    self.deferredHandler(data, deferred);
            //}, function(data) {
            //    self.deferredHandler(data, deferred, $translate.instant('error_renaming'));
            //})['finally'](function() {
            //    self.inprocess = false;
            //});
            return deferred.promise;
        };

        FileItem.prototype.copy = function() {
            var self = this;
            var deferred = $q.defer();

            var action = new FileCopyAction();
            action.setPath(self.tempModel.fullPath());

            self.inprocess = true;
            self.error = '';

            FilesController.updateInvokeFileItemAction(action, self.model.system.id, self.model.fullPath())
                .then(function(data) {
                    self.deferredHandler(data, deferred);
                }, function(data) {
                    self.deferredHandler(data, deferred, $translate.instant('error_copying'));
                })['finally'](function(data) {
                self.inprocess = false;
            });

            //var data = {params: {
            //    mode: "copy",
            //    path: self.model.fullPath(),
            //    newPath: self.tempModel.fullPath()
            //}};
            //
            //self.inprocess = true;
            //self.error = '';
            //$http.post(fileManagerConfig.copyUrl, data).then(function(data) {
            //    self.deferredHandler(data, deferred);
            //}, function(data) {
            //    self.deferredHandler(data, deferred, $translate.instant('error_copying'));
            //})['finally'](function() {
            //    self.inprocess = false;
            //});
            return deferred.promise;
        };

        FileItem.prototype.compress = function() {
            var self = this;
            var deferred = $q.defer();

            self.inprocess = true;
            self.error = '';

            // perform an unpacking of the compressed file/folder
            var transformRequest = new TransformRequest();
            transformRequest.setNativeFormat('zip-0');
            transformRequest.setUrl(self.tempModel._links.self.href);

            TransformsController.createSyncTransform(transformRequest, ProfilesController.me.username, self.model.fullPath())
                .then(function(data) {
                    self.deferredHandler(data, deferred);
                }, function(data) {
                    self.deferredHandler(data, deferred, $translate.instant('error_compressing'));
                })["finally"](function() {
                    self.inprocess = false;
                });

            //var data = {params: {
            //    mode: "compress",
            //    path: self.model.fullPath(),
            //    destination: self.tempModel.fullPath()
            //}};
            //
            //self.inprocess = true;
            //self.error = '';
            //$http.post(fileManagerConfig.compressUrl, data).then(function(data) {
            //    self.deferredHandler(data, deferred);
            //}, function(data) {
            //    self.deferredHandler(data, deferred, $translate.instant('error_compressing'));
            //})['finally'](function() {
            //    self.inprocess = false;
            //});
            return deferred.promise;
        };

        FileItem.prototype.extract = function() {
            var self = this;
            var deferred = $q.defer();

            self.inprocess = true;
            self.error = '';

            // perform an unpacking of the compressed file/folder
            var transformRequest = new TransformRequest();
            transformRequest.setNativeFormat('RAW-0');
            transformRequest.setUrl(self.tempModel._links.self.href);

            TransformsController.createSyncTransform(transformRequest, ProfilesController.me.username, self.model.fullPath())
                .then(function(data) {
                    self.deferredHandler(data, deferred);
                }, function(data) {
                    self.deferredHandler(data, deferred, $translate.instant('error_extracting'));
                })["finally"](function() {
                    self.inprocess = false;
                });

            //var data = {params: {
            //    mode: "extract",
            //    path: self.model.fullPath(),
            //    sourceFile: self.model.fullPath(),
            //    destination: self.tempModel.fullPath()
            //}};
            //
            //self.inprocess = true;
            //self.error = '';
            //$http.post(fileManagerConfig.extractUrl, data).then(function(data) {
            //    self.deferredHandler(data, deferred);
            //}, function(data) {
            //    self.deferredHandler(data, deferred, $translate.instant('error_extracting'));
            //})["finally"](function() {
            //    self.inprocess = false;
            //});
            return deferred.promise;
        };

        FileItem.prototype.download = function(preview) {
            var self = this;
            var deferred = $q.defer();

            var data = {
                force: "true"
            };

            // can't force auth through a separate window, so we create a postit
            // and use that to force the download
            var postitIt = new PostItRequest();
            postitIt.setMaxUses(2);
            postitIt.setMethod("GET");
            postitIt.setUrl([self.model._links.self.href, $.param(data)].join('?'));

            PostitsController.addPostit(postitIt)
                .then(function(data) {
                    if (self.model.type !== 'dir') {
                        window.open(data._links.self.href, '_blank', '');
                    }
                    self.deferredHandler(data, deferred);
                }, function(data) {
                    self.deferredHandler(data, deferred, $translate.instant('error_getting_content'));
                })['finally'](function() {
                self.inprocess = false;
            });
        };

        FileItem.prototype.preview = function() {
            var self = this;
            return self.download(true);
        };

        FileItem.prototype.getContent = function() {
            var self = this;
            var deferred = $q.defer();

            self.inprocess = true;
            self.error = '';
            FilesController.getDownloadFileItem(self.tempModel.fullPath(), self.model.system.id, false)
                .then(function(data) {
                    if (angular.isObject(data)) {
                        self.tempModel.content = self.model.content = JSON.stringify(data, null, 2);
                    } else {
                        self.tempModel.content = self.model.content = data;
                    }
                    self.deferredHandler({ result: self.tempModel.content }, deferred);
                }, function(data) {
                    self.deferredHandler(data, deferred, $translate.instant('error_getting_content'));
                })['finally'](function() {
                    self.inprocess = false;
                });

            //var data = {params: {
            //    mode: "editfile",
            //    path: self.tempModel.fullPath()
            //}};

            //self.inprocess = true;
            //self.error = '';
            //$http.post(fileManagerConfig.getContentUrl, data).then(function(data) {
            //    self.tempModel.content = self.model.content = data.result;
            //    self.deferredHandler(data, deferred);
            //}, function(data) {
            //    self.deferredHandler(data, deferred, $translate.instant('error_getting_content'));
            //})['finally'](function() {
            //    self.inprocess = false;
            //});
            return deferred.promise;
        };

        FileItem.prototype.remove = function() {
            var self = this;
            var deferred = $q.defer();


            self.inprocess = true;
            self.error = '';
            FilesController.deleteFileItem(self.tempModel.fullPath(), self.model.system.id)
                .then(function(data) {
                    self.deferredHandler({ result: data ? data: 'Successfully removed object'}, deferred);
                }, function(data) {
                    self.deferredHandler(data, deferred, $translate.instant('error_deleting'));
                })['finally'](function() {
                    self.inprocess = false;
                });

            //var data = {params: {
            //    mode: "delete",
            //    path: self.tempModel.fullPath()
            //}};

            //self.inprocess = true;
            //self.error = '';
            //$http.post(fileManagerConfig.removeUrl, data).then(function(data) {
            //    self.deferredHandler(data, deferred);
            //}, function(data) {
            //    self.deferredHandler(data, deferred, $translate.instant('error_deleting'));
            //})['finally'](function() {
            //    self.inprocess = false;
            //});
            return deferred.promise;
        };

        FileItem.prototype.edit = function() {
            var self = this;
            var deferred = $q.defer();

            self.inprocess = true;
            self.error = '';
            FilesController.uploadBlob(self.tempMode.content, self.tempMode.name, self.tempMode.path.join('/'), false)
                .then(function(data) {

                    self.deferredHandler(data, deferred);
                }, function(data) {
                    self.deferredHandler(data, deferred, $translate.instant('error_saving_content'));
                })['finally'](function(data) {
                    self.inprocess = false;
                });


            //var data = {params: {
            //    mode: "savefile",
            //    content: self.tempModel.content,
            //    path: self.tempModel.fullPath()
            //}};
            //
            //self.inprocess = true;
            //self.error = '';
            //
            //$http.post(fileManagerConfig.editUrl, data).then(function(data) {
            //    self.deferredHandler(data, deferred);
            //}, function(data) {
            //    self.deferredHandler(data, deferred, $translate.instant('error_modifying'));
            //})['finally'](function() {
            //    self.inprocess = false;
            //});
            return deferred.promise;
        };

        FileItem.prototype.fetchPermissions = function() {
            var self = this;
            var deferred = $q.defer();

            self.inprocess = true;
            self.error = '';
            FilesController.listFileItemPermissions(this.model.system.id, 99999, 0, self.tempModel.fullPath())
                .then(function(data) {
                    self.deferredHandler(data, deferred);
                }, function(data) {
                    self.deferredHandler(data, deferred, $translate.instant('error_changing_perms'));
                })['finally'](function() {
                self.inprocess = false;
            });

            return deferred.promise;
        };

        FileItem.prototype.changePermissions = function() {
            var self = this;
            var deferred = $q.defer();

            var newPem = new FilePermissionRequest();
            newPem.setUsername(self.tempModel.username);
            newPem.setPermission(self.tempModel.perms);
            newPem.setRecursive(self.tempModel.type === 'file' && self.tempModel.perms.recursive);

            self.inprocess = true;
            self.error = '';
            FilesController.updateFileItemPermission(newPem, this.model.system.id, self.tempModel.fullPath())
                .then(function(data) {
                    self.deferredHandler(data, deferred);
                }, function(data) {
                    self.deferredHandler(data, deferred, $translate.instant('error_changing_perms'));
                })['finally'](function() {
                    self.inprocess = false;
                });

            //
            //var data = {params: {
            //    mode: "changepermissions",
            //    path: self.tempModel.fullPath(),
            //    perms: self.tempModel.perms.toOctal(),
            //    permsCode: self.tempModel.perms.toCode(),
            //    recursive: self.tempModel.recursive
            //}};

            //self.inprocess = true;
            //self.error = '';
            //$http.post(fileManagerConfig.permissionsUrl, data).then(function(data) {
            //    self.deferredHandler(data, deferred);
            //}, function(data) {
            //    self.deferredHandler(data, deferred, $translate.instant('error_changing_perms'));
            //})['finally'](function() {
            //    self.inprocess = false;
            //});
            return deferred.promise;
        };

        FileItem.prototype.isFolder = function() {
            return this.model.type === 'dir';
        };

        FileItem.prototype.isEditable = function() {
            return !this.isFolder() && fileManagerConfig.isEditableFilePattern.test(this.model.name);
        };

        FileItem.prototype.isImage = function() {
            return fileManagerConfig.isImageFilePattern.test(this.model.name);
        };

        FileItem.prototype.isCompressible = function() {
            return this.isFolder();
        };

        FileItem.prototype.isExtractable = function() {
            return !this.isFolder() && fileManagerConfig.isExtractableFilePattern.test(this.model.name);
        };

        return FileItem;
    }]);
})(window, angular, jQuery);
