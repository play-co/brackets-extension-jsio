
/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */
/*global define, brackets, $ */

define(function (require, exports, module) {
    'use strict';

    var ExtensionUtils      = brackets.getModule('utils/ExtensionUtils'),
        AppInit             = brackets.getModule('utils/AppInit'),
        PreferencesManager  = brackets.getModule('preferences/PreferencesManager');

    var preferencesId = 'jsio';
    var _preferences;


    AppInit.htmlReady(function () {
        _preferences = PreferencesManager.getExtensionPrefs(preferencesId);

        // Hide the right bar
        $('#main-toolbar')[0].style.display = 'none';
        $('.main-view .content')[0].style.right = '0';

        // Add the custom ui theme
        $('body').append('<link rel="stylesheet" href="' + ExtensionUtils.getModulePath(module) + 'uitheme.css">');
    });

});
