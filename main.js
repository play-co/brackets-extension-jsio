
/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */
/*global define, brackets, $ */

define(function (require, exports, module) {
    'use strict';

    var ExtensionUtils      = brackets.getModule('utils/ExtensionUtils'),
        AppInit             = brackets.getModule('utils/AppInit'),
        PreferencesManager  = brackets.getModule('preferences/PreferencesManager'),
        CommandManager      = brackets.getModule('command/CommandManager'),
        Commands      = brackets.getModule('command/Commands');

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

    window.addEventListener('message', function (event) {
        var data;
        try {
            data = JSON.parse(event.data);
        } catch (e) {
            return;
        }

        if (!data) { return; }

        var action;
        if (data.action === 'save') {
            action = CommandManager.execute(Commands.FILE_SAVE);
        }

        if (action && data._requestId) {
            action.done(function () {
                event.source.postMessage(JSON.stringify({
                    _jsio: true,
                    target: 'brackets',
                    responseFor: data._requestId
                }), '*');
            });
        }
    });
});
