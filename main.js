
/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */
/*global define, brackets, $ */

define(function (require, exports, module) {
    "use strict";

    var ExtensionUtils      = brackets.getModule("utils/ExtensionUtils"),
        AppInit             = brackets.getModule("utils/AppInit"),
        CommandManager      = brackets.getModule("command/CommandManager"),
        Menu                = brackets.getModule("command/Menus"),
        PreferencesManager  = brackets.getModule("preferences/PreferencesManager");

    var MENUS = {
        'jsio.run': {
            name: 'Run ▼',
            commands: {
                'command.targetSimulator': {
                    name: 'Simulator',
                    execute: function() { }
                },
                'command.targetRemote': {
                    name: 'Remote Device',
                    execute: function() { }
                }
            }
        },
        'jsio.target': {
            name: 'Target ▼',
            commands: {
                'command.runBuild': {
                    name: 'Build',
                    execute: function() { }
                },
                'command.runRun': {
                    name: 'Run',
                    execute: function() { }
                },
                'command.runBuildRun': {
                    name: 'Build & Run',
                    execute: function() { }
                }
            }
        }
    };

    var preferencesId = 'jsio';
    var _preferences;

    function _getCmd(cmdKey, cmdId,  cmdData) {
        var checkedPrefKey = cmdId + '.checked';
        // Register the command
        var cmd = CommandManager.register(cmdData.name, cmdId, function() {
            if (!cmd.getChecked()) {
                cmd.setChecked(true);
            } else {
                cmd.setChecked(false);
            }
        });
        // Checked?
        cmd.setChecked(_preferences.get(checkedPrefKey) || false);
        cmd.on('checkedStateChange', function() {
            _preferences.set(checkedPrefKey, Boolean(cmd.getChecked()));
        });
        return cmd;
    };

    AppInit.htmlReady(function () {
        _preferences = PreferencesManager.getExtensionPrefs(preferencesId);

        // Register Commands
        for (var menuKey in MENUS) {
            var menuData = MENUS[menuKey];
            var menu = Menu.addMenu(menuData.name, menuKey, 'LAST', null, true);

            for (var cmdKey in menuData.commands) {
                var cmdData = menuData.commands[cmdKey];
                var cmdId = preferencesId + '.' + cmdKey;
                var cmd = _getCmd(cmdKey, cmdId, cmdData);
                // Add it to the menu
                menu.addMenuItem(cmdId);
            }
        }

        // Hide live preview
        $('#toolbar-go-live').remove();
    });
    ExtensionUtils.loadStyleSheet(module, 'jsio.css');
});
