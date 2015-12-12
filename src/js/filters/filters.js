(function(angular) {
    "use strict";
    var app = angular.module('FileManagerApp');

    app.filter('strLimit', ['$filter', function($filter) {
        return function(input, limit) {
            if (input.length <= limit) {
                return input;
            }
            return $filter('limitTo')(input, limit) + '...';
        };
    }]);

    app.filter('formatDate', ['$filter', function($filter) {
        return function(input, limit) {
            return input instanceof Date ?
                input.toISOString().substring(0, 19).replace('T', ' ') :
                (input.toLocaleString || input.toString).apply(input);
        };
    }]);

    app.filter('fileIcon', ['$filter', function($filter) {
        return function(fname) {
            var extensionIcons = {
                'parentdir': 'fa-level-up fa-flip-horizontal',
                'xls': 'fa-file-excel-o',
                'xlsx': 'fa-file-excel-o',
                'doc': 'fa-file-word-o',
                'docx': 'fa-file-word-o',
                'ppt': 'fa-file-powerpoint-o',
                'pptx': 'fa-file-powerpoint-o',
                'pdf': 'fa-file-pdf-o',
                'mpg4': " ",
                'hqx': 'fa-file-archive-o',
                'cpt': 'fa-file-archive-o',
                'csv': 'fa-file-code-o',
                'bin': 'fa-file-exe-o',
                'dms': '',
                'lha': '',
                'lzh': '',
                'exe': 'fa-file-exe-o',
                'class': 'fa-file-code-o',
                'psd': '',
                'so': '',
                'sea': '',
                'dll': 'fa-file-exe-o',
                'oda': '',
                'ai': '',
                'eps': '',
                'ps': '',
                'smi': '',
                'smil': '',
                'mif': 'fa-file-code-o',
                'wbxml': 'fa-file-code-o',
                'wmlc': 'fa-file-code-o',
                'dcr': 'fa-file-movie-o',
                'dir': 'fa-file-movie-o',
                'dxr': 'fa-file-movie-o',
                'dvi': 'fa-file-movie-o',
                'gtar': 'fa-file-archive-o',
                'gz': 'fa-file-archive-o',
                'php': 'fa-file-code-o',
                'php4': 'fa-file-code-o',
                'php3': 'fa-file-code-o',
                'phtml': 'fa-file-code-o',
                'phps': 'fa-file-code-o',
                'js': 'fa-file-code-o',
                'swf': 'fa-file-code-o',
                'sit': 'fa-file-archive-o',
                'tar': 'fa-file-archive-o',
                'tgz': 'fa-file-archive-o',
                'xhtml': 'fa-file-code-o',
                'xht': 'fa-file-code-o',
                'zip': 'fa-file-zip-o',
                'mid': 'fa-file-audio-o',
                'midi': 'fa-file-audio-o',
                'mpga': 'fa-file-audio-o',
                'mp2': 'fa-file-audio-o',
                'mp3': 'fa-file-audio-o',
                'aif': 'fa-file-audio-o',
                'aiff': 'fa-file-audio-o',
                'aifc': 'fa-file-audio-o',
                'ram': 'fa-file-audio-o',
                'rm': 'fa-file-audio-o',
                'rpm': 'fa-file-audio-o',
                'ra': 'fa-file-audio-o',
                'rv': 'fa-file-movie-o',
                'wav': 'fa-file-audio-o',
                'bmp': 'fa-file-image-o',
                'gif': 'fa-file-image-o',
                'jpeg': 'fa-file-image-o',
                'jpg': 'fa-file-image-o',
                'jpe': 'fa-file-image-o',
                'png': 'fa-file-image-o',
                'tiff': 'fa-file-image-o',
                'tif': 'fa-file-image-o',
                'css': 'fa-file-code-o',
                'html': 'fa-file-code-o',
                'htm': 'fa-file-code-o',
                'shtml': 'fa-file-code-o',
                'txt': 'fa-file-text-o',
                'text': 'fa-file-text-o',
                'log': 'fa-file-text-o',
                'rtx': 'fa-file-text-o',
                'rtf': 'fa-file-text-o',
                'xml': 'fa-file-code-o',
                'xsl': 'fa-file-code-o',
                'mpeg': 'fa-file-movie-o',
                'mpg': 'fa-file-movie-o',
                'mpe': 'fa-file-movie-o',
                'qt': 'fa-file-movie-o',
                'mov': 'fa-file-movie-o',
                'avi': 'fa-file-movie-o',
                'movie': 'fa-file-movie-o',
                'eml': '',
                'json': 'fa-file-code-o'
            };
            var extension = fname.substr((~-fname.lastIndexOf(".") >>> 0) + 2);

            if (extension) {
                var iconClass = extensionIcons[extension.toLowerCase()];
                return iconClass ? iconClass : 'fa-file-alt';
            } else {
                return 'fa-file-o';
            }
        };
    }]);

})(angular);
