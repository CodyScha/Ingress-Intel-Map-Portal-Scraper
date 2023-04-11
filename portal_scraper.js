// ==UserScript==
// @author         Ingress Max Fielding Agency
// @name           IITC plugin: Portal Scraper
// @category       Info
// @version        1.0.0
// @description    Display and download a list of portals on screen as a text file
// @id             portal-scraper
// @namespace      https://github.com/CodyScha/Ingress-Intel-Map-Portal-Scraper.git
// @match          https://intel.ingress.com/*
// @grant          none
// ==/UserScript==

function wrapper(plugin_info) {
  // ensure plugin framework is there, even if iitc is not yet loaded
  if (typeof window.plugin !== "function") window.plugin = function () {};

  //PLUGIN AUTHORS: writing a plugin outside of the IITC build environment? if so, delete these lines!!
  //(leaving them in place might break the 'About IITC' page or break update checks)
  plugin_info.buildName = "release";
  plugin_info.dateTimeVersion = "2023-04-10-230410";
  plugin_info.pluginId = "portal-scraper";
  //END PLUGIN AUTHORS NOTE

  // use own namespace for plugin
  window.plugin.portalscraper = function () {};

  window.plugin.portalscraper.listPortals = [];
  window.plugin.portalscraper.sortBy = 1; // second column: level
  window.plugin.portalscraper.sortOrder = -1;
  window.plugin.portalscraper.enlP = 0;
  window.plugin.portalscraper.resP = 0;
  window.plugin.portalscraper.neuP = 0;
  window.plugin.portalscraper.visitedP = 0;
  window.plugin.portalscraper.capturedP = 0;
  window.plugin.portalscraper.scoutControlledP = 0;

  window.plugin.portalscraper.filter = 0;

  /*
   * plugins may add fields by appending their specifiation to the following list. The following members are supported:
   * title: String
   *     Name of the column. Required.
   * value: function(portal)
   *     The raw value of this field. Can by anything. Required, but can be dummy implementation if sortValue and format
   *     are implemented.
   * sortValue: function(value, portal)
   *     The value to sort by. Optional, uses value if omitted. The raw value is passed as first argument.
   * sort: function(valueA, valueB, portalA, portalB)
   *     Custom sorting function. See Array.sort() for details on return value. Both the raw values and the portal objects
   *     are passed as arguments. Optional. Set to null to disable sorting
   * format: function(cell, portal, value)
   *     Used to fill and format the cell, which is given as a DOM node. If omitted, the raw value is put in the cell.
   * defaultOrder: -1|1
   *     Which order should by default be used for this column. -1 means descending. Default: 1
   */

  splitLatLng = function (tempLatLng) {//uesed to split the latitude and longitude into an easier to read string
    //LatLng(38.791153, -90.001165)
    var commaSpot = tempLatLng.toString().indexOf(",");
    var latLng =
      tempLatLng.toString().substring(7, commaSpot) +
      ";" +
      tempLatLng
        .toString()
        .substring(commaSpot + 2, tempLatLng.toString().length - 1);
    return latLng;
  };
  teamFix = function (teamNumber) {//prints out the name instead of the number that is given
    //0=NEU,1=RES,2=ENL,3=UNK
    var team = ["NEU", "RES", "ENL", "UNK"];
    return team[teamNumber];
  };

  window.plugin.portalscraper.fields = [
    {
      title: "Portal Info",
      value: function (portal) {//gets the portal info for download
        return (
          portal.options.data.title +
          ";" +
          splitLatLng(portal.getLatLng()) +
          ";" +
          teamFix(portal.options.team) +
          ";" +
          portal.options.data.health +
          ";+"
        );
      },
      format: function (cell, portal, value) {//formats left column
        $(cell).append(value.trim());
      },
    },
    {
      title: "Portal Title",
      value: function (portal) {//List of portals that you can click on to jump to
        return portal.options.data.title;
      },
      sortValue: function (value, portal) {
        return value.toLowerCase();
      },
      format: function (cell, portal, value) {
        $(cell)
          // .append(value.trim())
          .append(plugin.portalscraper.getPortalLink(portal))
          .addClass("portalTitle");
      },
    },
    
  ];

  //fill the listPortals array with portals avaliable on the map (level filtered portals will not appear in the table)
  window.plugin.portalscraper.getPortals = function () {
    //filter : 0 = All, 1 = Neutral, 2 = Res, 3 = Enl, -x = all but x
    var retval = false;

    var displayBounds = map.getBounds();

    window.plugin.portalscraper.listPortals = [];
    $.each(window.portals, function (i, portal) {
      // eliminate offscreen portals (selected, and in padding)
      if (!displayBounds.contains(portal.getLatLng())) return true;

      if (!("title" in portal.options.data)) {
        return true; // filter out placeholder portals
      }

      retval = true;

      switch (portal.options.team) {
        case TEAM_RES:
          window.plugin.portalscraper.resP++;
          break;
        case TEAM_ENL:
          window.plugin.portalscraper.enlP++;
          break;
        default:
          window.plugin.portalscraper.neuP++;
      }
      if (portal.options.data.history.visited)
        window.plugin.portalscraper.visitedP++;
      if (portal.options.data.history.captured)
        window.plugin.portalscraper.capturedP++;
      if (portal.options.data.history.scoutControlled)
        window.plugin.portalscraper.scoutControlledP++;

      // cache values and DOM nodes
      var obj = { portal: portal, values: [], sortValues: [] };

      var row = document.createElement("tr");
      row.className = TEAM_TO_CSS[portal.options.team];
      obj.row = row;

      var cell = row.insertCell(-1);
      cell.className = "alignR";

      window.plugin.portalscraper.fields.forEach(function (field, i) {
        cell = row.insertCell(-1);

        var value = field.value(portal);
        obj.values.push(value);

        obj.sortValues.push(
          field.sortValue ? field.sortValue(value, portal) : value
        );

        if (field.format) {
          field.format(cell, portal, value);
        } else {
          cell.textContent = value;
        }
      });

      window.plugin.portalscraper.listPortals.push(obj);
    });

    return retval;
  };

  window.plugin.portalscraper.displayPL = function () {
    var list;
    // plugins (e.g. bookmarks) can insert fields before the standard ones - so we need to search for the 'level' column
    window.plugin.portalscraper.sortBy = window.plugin.portalscraper.fields
      .map(function (f) {
        return f.title;
      })
      .indexOf("Level");
    window.plugin.portalscraper.sortOrder = -1;
    window.plugin.portalscraper.enlP = 0;
    window.plugin.portalscraper.resP = 0;
    window.plugin.portalscraper.neuP = 0;
    window.plugin.portalscraper.visitedP = 0;
    window.plugin.portalscraper.capturedP = 0;
    window.plugin.portalscraper.scoutControlledP = 0;
    window.plugin.portalscraper.filter = 0;

    if (window.plugin.portalscraper.getPortals()) {
      list = window.plugin.portalscraper.portalTable(
        window.plugin.portalscraper.sortBy,
        window.plugin.portalscraper.sortOrder,
        window.plugin.portalscraper.filter,
        false
      );
    } else {
      list = $(
        '<table class="noPortals"><tr><td>Nothing to download!</td></tr></table>'
      );
    }

    if (window.useAppPanes()) {
      $('<div id="portalscraper" class="mobile">')
        .append(list)
        .appendTo(document.body);
    } else {
      dialog({
        html: $('<div id="portalscraper">').append(list),
        dialogClass: "ui-dialog-portalscraper",
        title:
          "Portal Scraper: " +
          window.plugin.portalscraper.listPortals.length +
          " " +
          (window.plugin.portalscraper.listPortals.length === 1
            ? "portal"
            : "portals"),
        id: "portal-Scraper",
        width: 700,
      });
    }
  };

  window.plugin.portalscraper.portalTable = function (
    sortBy,
    sortOrder,
    filter,
    reversed
  ) {
    // save the sortBy/sortOrder/filter
    window.plugin.portalscraper.sortBy = sortBy;
    window.plugin.portalscraper.sortOrder = sortOrder;
    window.plugin.portalscraper.filter = filter;

    var portals = window.plugin.portalscraper.listPortals;
    var sortField = window.plugin.portalscraper.fields[sortBy];

    //THIS COMMENT BLOCK FOR SORTING ONLY
    /*
    portals.sort(function (a, b) {
      var valueA = a.sortValues[sortBy];
      var valueB = b.sortValues[sortBy];

      if (sortField.sort) {
        return sortOrder * sortField.sort(valueA, valueB, a.portal, b.portal);
      }

      //FIXME: sort isn't stable, so re-sorting identical values can change the order of the list.
      //fall back to something constant (e.g. portal name?, portal GUID?),
      //or switch to a stable sort so order of equal items doesn't change
      return sortOrder * (valueA < valueB ? -1 : valueA > valueB ? 1 : 0);
    });


    if (filter !== 0) {
      portals = portals.filter(function (obj) {
        switch (filter) {
          case 1:
          case 2:
          case 3:
            return reversed ^ (1 + obj.portal.options.team === filter);
          case 4:
            return reversed ^ obj.portal.options.data.history.visited;
          case 5:
            return reversed ^ obj.portal.options.data.history.captured;
          case 6:
            return reversed ^ obj.portal.options.data.history.scoutControlled;
        }
      });
    }

    */
   //Download Data button creation
    var container = $("<div>");

    filters = document.createElement("div");
    filters.className = "filters";

    dl_button = document.createElement("button");
    dl_button.innerHTML =
      '<button id = "download_button" onclick="downloadFile()" class="hoverr" >Download Data</button>';

    container.append(filters);
    
    container.append(dl_button);
//This is also for sorting
    /*

    var length = window.plugin.portalscraper.listPortals.length;

    [
      "All",
      "Neutral",
      "Resistance",
      "Enlightened",
      "Visited",
      "Captured",
      "Scout Controlled",
    ].forEach(function (label, i) {
      var cell = filters.appendChild(document.createElement("div"));
      cell.className = "name filter" + label.substr(0, 3);
      cell.textContent = label + ":";
      cell.title = "Show only " + label + " portals";
      $(cell).click(function () {
        if (this.classList.contains("active")) {
          $("#portalscraper")
            .empty()
            .append(
              window.plugin.portalscraper.portalTable(
                sortBy,
                sortOrder,
                0,
                false
              )
            );
        } else {
          $("#portalscraper")
            .empty()
            .append(
              window.plugin.portalscraper.portalTable(
                sortBy,
                sortOrder,
                i,
                false
              )
            );
        }
      });

      if (filter === i && !reversed) {
        cell.classList.add("active");
      }

      cell = filters.appendChild(document.createElement("div"));
      cell.className = "count filter" + label.substr(0, 3);

      if (i == 0) {
        cell.textContent = length;
      } else {
        cell.title = "Hide " + label + " portals ";
        $(cell).click(function () {
          if (this.classList.contains("active")) {
            $("#portalscraper")
              .empty()
              .append(
                window.plugin.portalscraper.portalTable(
                  sortBy,
                  sortOrder,
                  0,
                  false
                )
              );
          } else {
            $("#portalscraper")
              .empty()
              .append(
                window.plugin.portalscraper.portalTable(
                  sortBy,
                  sortOrder,
                  i,
                  true
                )
              );
          }
        });

        if (filter === i && reversed) {
          cell.classList.add("active");
        }

        var name = [
          "neuP",
          "resP",
          "enlP",
          "visitedP",
          "capturedP",
          "scoutControlledP",
        ][i - 1];
        var count = window.plugin.portalscraper[name];
        cell.textContent =
          count + " (" + Math.round((count / length) * 100) + "%)";
      }
    });
    */
    //creates the areas for the table
    var tableDiv = document.createElement("div");
    tableDiv.className = "table-container";
    container.append(tableDiv);

    var table = document.createElement("table");
    table.className = "portals";
    tableDiv.appendChild(table);

    var thead = table.appendChild(document.createElement("thead"));
    var row = thead.insertRow(-1);

    var cell = row.appendChild(document.createElement("th"));

    //cell.textContent = 'number#';
    //loops throught the portals to sort
    window.plugin.portalscraper.fields.forEach(function (field, i) {
      cell = row.appendChild(document.createElement("th"));
      cell.textContent = field.title;
      if (field.sort !== null) {
        cell.classList.add("sortable");
        if (i === window.plugin.portalscraper.sortBy) {
          cell.classList.add("sorted");
        }

        $(cell).click(function () {
          var order;
          if (i === sortBy) {
            order = -sortOrder;
          } else {
            order = field.defaultOrder < 0 ? -1 : 1;
          }

          $("#portalscraper")
            .empty()
            .append(
              window.plugin.portalscraper.portalTable(
                i,
                order,
                filter,
                reversed
              )
            );
        });
      }
    });
    //a loop function to create the table rows
    portals.forEach(function (obj, i) {
      var row = obj.row;
      if (row.parentNode) row.parentNode.removeChild(row);

      //row.cells[0].textContent = i+1;

      table.appendChild(row);
    });

    //THIS BLOCK IS ONLY FOR THE DISCLAIMER
    /* container.append('<div class="disclaimer">Click on portals table headers to sort by that column. '
      + 'Click on <b>All, Neutral, Resistance, Enlightened</b> to only show portals owned '
      + 'by that faction or on the number behind the factions to show all but those portals. '
      + 'Click on <b>Visited, Captured or Scout Controlled</b> to only show portals the user has a history for '
      + 'or on the number to hide those. </div>'); */
    // container.prepend(
    //   '<div style="padding: 2px;max-width: 100px;color: #FFCE00;border: 1px solid #FFCE00;background-color: rgba(8, 48, 78, 0.9);text-align:center;" <button id = "download_button" onclick="downloadFile()" class="download_button" >Download Data</button></div>'
    // );

    return container;
  };

  // $("div.download_button").hover(function () {
  //   $(this).css("background-color", "red");
  // });

  //our function for downloading the data of the left column as a file
  downloadFile = function () {
    var hiddenElement = document.createElement("a");
    var textToSave = "";
    for (var i = 0; i < window.plugin.portalscraper.listPortals.length; i++) {
      textToSave = textToSave.concat(
        window.plugin.portalscraper.listPortals[i].values[0].toString() + "\n"
      );
      console.log(textToSave);
    }
    hiddenElement.href = "data:text," + encodeURIComponent(textToSave);
    hiddenElement.target = "_blank";
    hiddenElement.download = "ScrapedPortals.txt";
    hiddenElement.click();
  };

  // portal link - single click: select portal
  //               double click: zoom to and select portal
  // code from getPortalLink function by xelio from iitc: AP List - https://raw.github.com/breunigs/ingress-intel-total-conversion/gh-pages/plugins/ap-list.user.js
  window.plugin.portalscraper.getPortalLink = function (portal) {
    var coord = portal.getLatLng();
    var perma = window.makePermalink(coord);

    // jQuery's event handlers seem to be removed when the nodes are remove from the DOM
    var link = document.createElement("a");
    link.textContent = portal.options.data.title;
    link.href = perma;
    link.addEventListener(
      "click",
      function (ev) {
        renderPortalDetails(portal.options.guid);
        ev.preventDefault();
        return false;
      },
      false
    );
    link.addEventListener("dblclick", function (ev) {
      zoomToAndShowPortal(portal.options.guid, [coord.lat, coord.lng]);
      ev.preventDefault();
      return false;
    });
    return link;
  };
  //display the pane of info
  window.plugin.portalscraper.onPaneChanged = function (pane) {
    if (pane === "plugin-portalscraper")
      window.plugin.portalscraper.displayPL();
    else $("#portalscraper").remove();
  };
  //The CSS for the pane popup
  var setup = function () {
    if (window.useAppPanes()) {
      app.addPane("plugin-portalsraper", "Portal Scraper", "ic_action_paste");
      addHook("paneChanged", window.plugin.portalscraper.onPaneChanged);
    } else {
      $("#toolbox").append(
        '<a onclick="window.plugin.portalscraper.displayPL()" title="Display a list of portals in the current view [t]" accesskey="t">Portal Scraper</a>'
      );
    }
    $("<style>")
      .prop("type", "text/css")
      .html(
        "\
#portalscraper.mobile {\
  background: transparent;\
  border: 0 none;\
  height: 100%;\
  width: 100%;\
  left: 0;\
  top: 0;\
  position: absolute;\
  overflow: auto;\
}\
\
#portalscraper table {\
  margin-top: 5px;\
  border-collapse: collapse;\
  empty-cells: show;\
  width: 100%;\
  clear: both;\
}\
\
#portalscraper table td, #portalscraper table th {\
  background-color: #1b415e;\
  border-bottom: 1px solid #0b314e;\
  color: white;\
  padding: 3px;\
  white-space: nowrap;\
  vertical-align: middle;\
}\
\
#portalscraper table th {\
  text-align: center;\
}\
\
#portalscraper table .alignR {\
  text-align: right;\
}\
\
#portalscraper table.portals td {\
  white-space: nowrap;\
}\
\
#portalscraper table th.sortable {\
  cursor: pointer;\
}\
\
#portalscraper table .portalTitle {\
  min-width: 120px;\
  max-width: 240px;\
  overflow: hidden;\
  white-space: nowrap;\
  text-overflow: ellipsis;\
}\
\
#portalscraper .sorted {\
  color: #FFCE00;\
}\
\
#portalscraper .filters {\
  display: grid;\
  grid-template-columns: 1fr auto 1fr auto 1fr auto 1fr auto;\
  grid-gap: 1px\
}\
\
#portalscraper .filters div {\
  padding: 0.2em 0.3em;\
  overflow: hidden;\
  text-overflow: ellipsis;\
  background-color: #0005;\
  white-space: nowrap;\
}\
\
#portalscraper .filters .count {\
  text-align: right;\
}\
\
#portalscraper .filters .active {\
  font-weight: bolder;\
  color: #FFCE00;\
}\
\
#portalscraper .filters .filterAll {\
  display: none;\
}\
\
#portalscraper.mobile .filters .filterAll {\
  display: block;\
}\
\
/* kitkat fallback */\
#portalscraper.mobile .filters .name {\
  float: left;\
}\
\
#portalscraper .filters .filterNeu,\
#portalscraper .filters .filterEnl,\
#portalscraper .filters .filterRes,\
#portalscraper .filters .filterUnk {\
  grid-row: 1;\
}\
\
#portalscraper .filters .filterVis,\
#portalscraper .filters .filterCap,\
#portalscraper .filters .filterSco {\
  grid-row: 2;\
}\
\
/* 2 columns */\
@media (orientation: portrait) {\
  #portalscraper .filters {\
    grid-template-columns: 1fr auto 1fr auto;\
  }\
\
  #portalscraper .filters .filterNeu.name,\
  #portalscraper .filters .filterRes.name,\
  #portalscraper .filters .filterEnl.name,\
  #portalscraper .filters .filterUnk.name {\
    grid-column: 1;\
  }\
\
  #portalscraper .filters .filterNeu.count,\
  #portalscraper .filters .filterRes.count,\
  #portalscraper .filters .filterEnl.count,\
  #portalscraper .filters .filterUnk.count {\
    grid-column: 2;\
  }\
\
  #portalscraper .filters .filterVis.name,\
  #portalscraper .filters .filterCap.name,\
  #portalscraper .filters .filterSco.name {\
    grid-column: 3;\
  }\
\
  #portalscraper .filters .filterVis.count,\
  #portalscraper .filters .filterCap.count,\
  #portalscraper .filters .filterSco.count {\
    grid-column: 4;\
  }\
\
  #portalscraper .filters .filterNeu,\
  #portalscraper .filters .filterVis {\
    grid-row: 1;\
  }\
\
  #portalscraper .filters .filterEnl,\
  #portalscraper .filters .filterCap {\
    grid-row: 2;\
  }\
\
  #portalscraper .filters .filterRes,\
  #portalscraper .filters .filterSco {\
    grid-row: 3;\
  }\
\
  #portalscraper .filters .filterUnk {\
    grid-row: 4;\
  }\
}\
\
#portalscraper .filters .filterNeu {\
  background-color: #666;\
}\
\
#portalscraper .filterVis.name:before,\
#portalscraper .filterCap.name:before,\
#portalscraper .filterSco.name:before {\
  content: '';\
  display: inline-block;\
  width: 11px;\
  height: 11px;\
  border-radius: 6px;\
  margin: auto;\
  margin-right: 0.2em;\
  vertical-align: -8%;\
}\
\
#portalscraper .filterVis:before {\
  background-color: yellow;\
}\
\
#portalscraper .filterCap:before {\
  background-color: red;\
}\
\
#portalscraper .filterSco:before {\
  background-color: purple;\
}\
\
#portalscraper .table-container {\
  overflow-y: hidden;\
}\
\
#portalscraper table tr.res td,\
#portalscraper .filters .filterRes {\
  background-color: #005684;\
}\
\
#portalscraper table tr.enl td,\
#portalscraper .filters .filterEnl {\
  background-color: #017f01;\
}\
\
#portalscraper table tr.mac td,\
#portalscraper .filters .filterUnk {\
  background-color: #652A0E;\
}\
\
#portalscraper table tr.none td {\
  background-color: #000;\
}\
\
#portalscraper .disclaimer {\
  margin-top: 10px;\
}\
\
#portalscraper .history .icon {\
  width: 11px;\
  height: 11px;\
  border-radius: 6px;\
  margin: auto;\
}\
\
#portalscraper .history.unvisited .icon{\
  background-color: white;\
}\
\
#portalscraper .history.visited .icon {\
  background-color: yellow;\
}\
\
#portalscraper .history.captured .icon {\
  background-color: red;\
}\
\
#portalscraper .history.scoutControlled .icon {\
  background-color: purple;\
}\
\
.ui-dialog.ui-dialog-portalscraper{\
  max-width: calc(100vw - 2px);\
}\
\
.hoverr:hover{\
  cursor: pointer;\
  background-color: #017f01;\
  padding: 2px;\
  max - width: 100px;\
  color: #FFCE00;\
  border: 1px solid #FFCE00; \
  background - color: rgba(8, 48, 78, 0.9);\
}\
"
      )
      .appendTo("head");
  };
  setup.info = plugin_info; //add the script info data to the function as a property
  if (!window.bootPlugins) window.bootPlugins = [];
  window.bootPlugins.push(setup);
  // if IITC has already booted, immediately run the 'setup' function
  if (window.iitcLoaded && typeof setup === "function") setup();
} // wrapper end
// inject code into site context
var script = document.createElement("script");
var info = {};
if (typeof GM_info !== "undefined" && GM_info && GM_info.script)
  info.script = {
    version: GM_info.script.version,
    name: GM_info.script.name,
    description: GM_info.script.description,
  };
script.appendChild(
  document.createTextNode("(" + wrapper + ")(" + JSON.stringify(info) + ");")
);
(document.body || document.head || document.documentElement).appendChild(
  script
);
