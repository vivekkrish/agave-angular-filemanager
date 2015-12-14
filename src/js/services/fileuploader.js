(function(window, angular) {
    "use strict";
    angular.module('FileManagerApp').service('fileUploader', ['$http', '$q', 'fileManagerConfig', 'Configuration', function ($http, $q, fileManagerConfig, Configuration) {

        function deferredHandler(data, deferred, errorMessage) {
            if (!data || typeof data !== 'object') {
                return deferred.reject('Bridge response error, please check the docs');
            }
            if (data.result && data.result.error) {
                return deferred.reject(data);
            }
            if (data.error) {
                return deferred.reject(data);
            }
            if (errorMessage) {
                return deferred.reject(errorMessage);
            }
            deferred.resolve(data);
        }

        this.requesting = false;

        this.upload = function(fileList, system, path) {
            if (! window.FormData) {
                throw new Error('Unsupported browser version');
            }
            var self = this;

            var promises = [];
            var totalUploaded = 0;

            var promises = angular.forEach(fileList, function (fileObj, key) {

            //});
            //var promises =  fileList.map(function(fileObj) {
                var form = new window.FormData();
                //var fileObj = fileListItem;
                if (fileObj instanceof window.File) {
                    form.append('fileToUpload', fileObj);
                    form.append('append', false);
                    form.append('fileType', 'raw');
                }
                self.requesting = true;
                var filesUri = Configuration.BASEURI + 'files/v2/media/system/' + system.id + '/' + path.join('/') + "?naked=true";
                promises.push($http.post(filesUri, form, {
                        transformRequest: angular.identity,
                        headers: {
                            "Content-Type": undefined,
                            "Authorization": "Bearer " + Configuration.oAuthAccessToken
                        }
                    }).success(function (data) {
                        return data;
                    }).error(function (data) {
                        return data;
                    })
                );
            });

            var deferred = $q.defer();

            return $q.all(promises).then(
                function(data) {
                    deferredHandler(data, deferred);
                },
                function(data) {
                    deferredHandler(data, deferred, 'Error uploading files');
                })
                ['finally'](function (data) {
                    self.requesting = false;
                });
        };
    }]);
})(window, angular);