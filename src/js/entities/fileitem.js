(function(window, angular, $) {
    "use strict";
    angular.module('FileManagerApp').factory('fileItem', ['$http', '$q', '$translate', '$localStorage', 'fileManagerConfig', 'AccessControlList', 'FilesController', 'FileManagementActionTypeEnum', 'PostitsController', 'TransformsController', 'Configuration', 'Upload',
        function($http, $q, $translate, $localStorage, fileManagerConfig, AccessControlList, FilesController, FileManagementActionTypeEnum, PostitsController, TransformsController, Configuration, Upload) {

        var FileItem = function(model, path, system) {
            var rawModel = {
                name: model && model.name || '',
                path: path || [],
                type: model && model.type || 'file',
                size: model && parseInt(model.length || 0),
                date: model && model.lastModified,
                perms: this.agaveFilePermission(model && model.permissions),
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

        // ACLs
         FileItem.prototype.getRwxObj = function() {
            return {
                  read: false,
                  write: false,
                  execute: false,
                  recursive: false,
            };
        };

        FileItem.prototype.transformRwxToAgave = function(rwxObj) {
          var result = '';
          if (rwxObj.read === true && rwxObj.write === true && rwxObj.execute === true){
            result = 'ALL';
          }
          else if (rwxObj.read = true && rwxObj.write === false && rwxObj.execute === false){
            result = 'READ';
          }
          else if (rwxObj.read = false && rwxObj.write === true && rwxObj.execute === false) {
            result = 'WRITE';
          }
          else if (rwxObj.read = false && rwxObj.write === false && rwxObj.execute === true) {
            result = 'EXECUTE';
          }
          else if (rwxObj.read = true && rwxObj.write === true && rwxObj.execute === false) {
            result = 'READ_WRITE';
          }
          else if (rwxObj.read = true && rwxObj.write === false && rwxObj.execute === true) {
            result = 'READ_EXECUTE';
          }
          else if (rwxObj.read = false && rwxObj.write === true && rwxObj.execute === true) {
            result = 'WRITE_EXECUTE';
          }
          else {
            result = 'EXECUTE';
          }
          return result;
        };

        FileItem.prototype.transformAgaveToRwx = function(agavePermission) {
            var rwxObj = this.getRwxObj();

            switch(agavePermission){
                case "ALL":
                    rwxObj.read = true;
                    rwxObj.write = true;
                    rwxObj.execute = true;
                  break;
                case "READ":
                    rwxObj.read = true;
                  break;
                case "WRITE":
                    rwxObj.write = true;
                  break;
                case "EXECUTE":
                    rwxObj.execute = true;
                  break;
                case "READ_WRITE":
                    rwxObj.read = true;
                    rwxObj.write = true;
                  break;
                case "READ_EXECUTE":
                    rwxObj.read = true;
                    rwxObj.execute = true;
                  break;
                case "WRITE_EXECUTE":
                    rwxObj.write = true;
                    rwxObj.execute = true;
                  break;
                case "EXECUTE":
                    rwxObj.execute = true;
                  break;
            }

            return rwxObj;
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
          return deferred.promise;
        };

        // permissions for single user
        FileItem.prototype.agaveFilePermission = function (agavePermission) {
          var pems = {};
          var username = $localStorage.activeProfile.username;
          pems[username] = this.transformAgaveToRwx(agavePermission);
          return pems;
        };

        // permissions for all group/users
       FileItem.prototype.agaveFilePermissions = function (agavePermission, username) {
          var self = this;
          self.inprocess = true;
          var deferred = $q.defer();

          FilesController.listFileItemPermissions(self.model.system.id, 99999, 0, self.model.fullPath())
            .then(function(data){
              angular.forEach(data, function(pem) {
                self.model.perms[pem.username] = pem.permission;
                self.model.recursive = pem.recursive;
                self.tempModel.recursive = pem.recursive;
                self.model.perms[pem.username].recursive = pem.recursive;
                self.tempModel.perms[pem.username] = angular.copy(self.model.perms[pem.username]);
              });
              self.inprocess = false;
            })
            .catch(function(data){
              self.deferredHandler(data, deferred, $translate.instant('error_changing_perms'));
              self.inprocess = false;
            })
        };

        FileItem.prototype.changePermission = function(pem, username){
          var self = this;
          var deferred = $q.defer();
          var newPem = new FilePermissionRequest();

          newPem.setUsername(username);
          newPem.setPermission(self.transformRwxToAgave(pem));
          newPem.setRecursive(self.tempModel.type === 'file' && pem.recursive);

          self.inprocess = true;
          self.error = '';

          var path = self.model.path.join('/') + '/' + self.model.name;

          FilesController.updateFileItemPermission(newPem, this.model.system.id, path )
              .then(
                function(data) {
                  self.deferredHandler(data, deferred);
              }, function(data) {
                self.deferredHandler(data, deferred, $translate.instant('error_changing_perms'));
              })
              ['finally'](function (data) {
                self.inprocess = false;
              });


          return deferred.promise;
        };

        FileItem.prototype.changePermissions = function() {
          var self = this;
          var promises = [];

          angular.forEach(self.tempModel.perms, function(pem, username){
            if (JSON.stringify(self.model.perms[username]) !== JSON.stringify(self.tempModel.perms[username])) {
              promises.push(self.changePermission(pem, username));
            }
          });

          var deferred = $q.defer();

          return $q.all(promises)
            .then(
              function(data) {
                self.deferredHandler(data, deferred, $translate.instant('error_changing_perms'));
                return deferred.promise;
            })
            .catch(function(data){
                self.deferredHandler(data, deferred, $translate.instant('error_changing_perms'));
                return deferred.promise;
            });
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
            return deferred.promise;
        };

        FileItem.prototype.download = function(preview) {
            var self = this;
            var deferred = $q.defer();

            self.inprocess = true;
            self.error = '';

            if (preview === true){
              if (self.tempModel.preview){
                self.tempModel.preview = {};
              }

              if (self.isImage()){
                var data = {
                    force: "true"
                };

                var postitIt = new PostItRequest();
                postitIt.setMaxUses(2);
                postitIt.setMethod("GET");
                postitIt.setUrl([self.model._links.self.href, $.param(data)].join('?'));

                PostitsController.addPostit(postitIt)
                    .then(function(data) {
                      self.tempModel.preview = {};
                      self.tempModel.preview.isImage = true;
                      self.tempModel.preview.url = data._links.self.href;
                      self.tempModel.preview.isPreviewable = self.isPreviewable();
                      self.deferredHandler(data, deferred);
                    }, function(data){
                      self.deferredHandler(data, deferred, $translate.instant('error_getting_content'));
                    })['finally'](function() {
                      self.inprocess = false;
                    });
              } else {
                var filePath = $localStorage.tenant.baseUrl + 'files/v2/media/system/' + self.model.system.id + self.model.fullPath();

                $http({
                     method: 'GET',
                     url: filePath,
                     responseType: 'arraybuffer',
                     cache: false,
                     headers: {
                       'Authorization': 'Bearer ' + $localStorage.token.access_token
                     }
                 }).success(function(data){
                   self.tempModel.preview = {};
                   if (self.isPdf()){
                     self.tempModel.preview.isPdf = true;
                     self.tempModel.preview.data = URL.createObjectURL(new Blob([data], {type: 'application/pdf'}));
                   } else {
                     self.tempModel.preview.isText = true;
                     self.tempModel.preview.data = URL.createObjectURL(new Blob([data]));
                   }
                   self.tempModel.preview.isPreviewable = self.isPreviewable();
                   self.inprocess = false;
                   self.deferredHandler(data, deferred, data.message);
                 }).error(function(data){
                   self.deferredHandler(data, deferred, $translate.instant('error_getting_content'));
                   self.inprocess = false;
                 });
              }
            } else {
              var data = {
                  force: "true"
              };

              var postitIt = new PostItRequest();
              postitIt.setMaxUses(2);
              postitIt.setMethod("GET");
              postitIt.setUrl([self.model._links.self.href, $.param(data)].join('?'));

              PostitsController.addPostit(postitIt)
                  .then(function(data) {
                      if (self.model.type !== 'dir') {
                        self.tempModel.preview.isPdf = self.isPdf();
                        self.tempModel.preview.isImage = self.isImage();
                        self.tempModel.preview.isText = self.isText();

                        var link = document.createElement('a');
                        link.setAttribute('download', null);
                        link.setAttribute('href', data._links.self.href);
                        link.style.display = 'none';

                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                      }
                      self.deferredHandler(data, deferred);
                  }, function(data){
                      self.deferredHandler(data, deferred, $translate.instant('error_getting_content'));
                  })['finally'](function() {
                    self.inprocess = false;
                  });
            }

            return deferred.promise;
        };

         FileItem.prototype.preview = function() {
            var self = this;
            var deferred = $q.defer();

            self.download(true)
              .then(
                function(data){
                  self.deferredHandler(data, deferred);
                },
                function(data){
                  self.deferredHandler(data, deferred, $translate.instant('error_displaying'));
                });

            return  deferred.promise;
        };

         FileItem.prototype.getContent = function() {
            var self = this;
            var deferred = $q.defer();

            self.inprocess = true;
            self.error = '';
            FilesController.getDownloadFileItem(self.tempModel.fullPath(), self.model.system.id, false)
                .then(function(data) {
                    if (typeof self.tempModel.preview === 'undefined'){
                      self.tempModel.preview = {};
                    }
                    if (angular.isObject(data)) {
                        self.tempModel.content = self.model.content = JSON.stringify(data, null, 2);
                    } else {
                        self.tempModel.content = self.model.content = data;
                    }

                    self.tempModel.preview.isEdit = true;
                    self.deferredHandler({ result: self.tempModel.content }, deferred);
                }, function(data) {
                    self.deferredHandler(data, deferred, $translate.instant('error_getting_content'));
                })['finally'](function() {
                    self.inprocess = false;
                });

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

            return deferred.promise;
        };

        FileItem.prototype.editSave = function() {
            var self = this;
            var deferred = $q.defer();
            self.inprocess = true;

            var filePath = Configuration.BASEURI + 'files/v2/media/system/' + self.tempModel.system.id + '/' + self.tempModel.path.join('/') + "?naked=true";
            var blob = new Blob([self.tempModel.content], {type: "text/plain"})
            var file = new File([blob], self.tempModel.name, {type: "text/plain"});

            Upload.upload({
                url: filePath,
                // data: formData,
                data: {
                  file: file,
                  fileToUpload: file,
                  append: false,
                  fileType: 'raw'
                },
                method: 'POST',
                headers: {
                  "Content-Type": undefined,
                  "Authorization": "Bearer " + Configuration.oAuthAccessToken
                }
            }).then(
              function (data) {
                self.deferredHandler(data, deferred);
            }, function (data) {
                self.deferredHandler(data, deferred, $translate.instant('error_saving'));
            })['finally'](function (data) {
                self.inprocess = false;
            });
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

            return deferred.promise;
        };

        FileItem.prototype.isFolder = function() {
            return this.model.type === 'dir';
        };

        FileItem.prototype.isPreviewable = function() {
           return !this.isFolder() && fileManagerConfig.isPreviewableFilePattern.test(this.model.name);
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

        FileItem.prototype.isPdf = function(){
            return !this.isFolder() && fileManagerConfig.isPdfFilePattern.test(this.model.name);
        };

        FileItem.prototype.isText = function(){
            return !this.isFolder() && fileManagerConfig.isTextFilePattern.test(this.model.name);
        };

        return FileItem;
    }]);
})(window, angular, jQuery);
