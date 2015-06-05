
/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */
/*global define, brackets, $ */

define(function (require, exports, module) {
    "use strict";

    // Brackets modules
    var EditorManager           = brackets.getModule("editor/EditorManager"),
        ExtensionUtils          = brackets.getModule("utils/ExtensionUtils"),
        AppInit                 = brackets.getModule("utils/AppInit");

    /**
     * Add the bee!
     */
    function _addBee() {
        $("<div class='weeby bee'><div></div></div>").appendTo($('.pane-content')[0]);
    }

    AppInit.htmlReady(function () {
        _addBee();
    });
    ExtensionUtils.loadStyleSheet(module, 'jsio.css');
});
