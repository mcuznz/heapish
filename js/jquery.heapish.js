/**********************************************
 * Heapish
 * ********************************************
 * a jQuery Plugin for semi-self-organizing
 * piles of content.
 *
 * Mike Cousins / @mcuznz / github.com/mcuznz
 **********************************************/

(function (factory) {
	if (typeof define === 'function' && define.amd) {
		// AMD. Register as anonymous module.
		define(['jquery'], factory);
    } else if(typeof exports === 'object') {
		factory(require('jquery'));
	} else {
		factory(jQuery);
	}
}(function ($) {

    var heap = [];
    var settings;
    var $el, heapishNode, $ruler;
    var validFormats = ['box', 'row'];
	var heapOrder = [];

    // States
	var ready = false;
	var stopped = false;
	var showingMeta = false;
	var editMode = false;

	/* Debounce:
	 *
	 * A Helper Function to rate-limit function calls; specifically used
	 * to keep organize from triggering too often on window.resize
	 */
	var debounce = function(callback, delay) {
		var db_timeout, lastT = 0;
		function debouncer() {
			var self = this,
				deltaT = +new Date() - lastT,
				args = arguments;

			function exec() {
				lastT = +new Date();
				callback.apply(self, args);
			}

			db_timeout && clearTimeout(db_timeout);
			db_timeout = setTimeout(exec, delay);
		}
		return debouncer;
	}

    /* The Setup function:
	 *
	 * This creates a Heap in the supplied element from:
	 * - The children of said Element (treating them as Boxes)
	 * - Any Heap-objects provided by settings.data
	 *
	 * Note that settings is a merger of heapish.defaults and
	 * the options argument, the .data property may be set in
	 * either place.
	 */
	$.fn.heapish = function(options) {
        var args = Array.prototype.slice.call(arguments).shift();

		if (stopped) {
			if (ready && options && options == 'go') {
				$(this).heapish.go();
			}
			return;
		}

        if (ready && options && (typeof options == 'string' || options instanceof String) && $.isFunction($(this).heapish[options] )) {
            // call the supplied function and get out of dodge
            $(this).heapish[options].apply(this, args);
            return;
        }

        $el = $(this);
		$el.trigger("heapish-initializing");

		if (!settings) {
			if (options && $.isPlainObject(options)) {
				settings = $.extend({}, $.fn.heapish.defaults, options);
			} else {
				settings = $.extend({}, $.fn.heapish.defaults);
			}
		}

        $el.addClass(settings.uniqueClass || 'heapish');

        var debounced = debounce(organize, 250);
		$(window).resize(debounced);

		heapishNode = $el.get(0);

		var observer = new MutationObserver(function(mutations) {
			mutations.forEach(function(mutation){
				if (mutation.target == heapishNode &&
					mutation.type == "attributes" &&
					mutation.attributeName == "style") {
					debounced();
				}
			})
		});
		observer.observe(heapishNode, {attributes: true, childList: true, characterData: true});

        if (!$el.is(':empty')) {

            // There's already content - see if it has needed attributes?
            var $items = $el.children();
            $items.each(function(index, item) {
                if ($(item).is('div')) {
                    var $item = $(item);
                } else {
                    $(item).wrap("<div></div>");

                    // Move data attributes up to the parent
                    $(item).parent().data($(item).data());
                    $(item).removeData();

                    var $item = $(item).parent();
                }

                var format = settings.defaultFormat;

                if ($item.data('heapish-format') || $.inArray($item.data('heapish-format'), validFormats) !== -1) {
                    format = $item.data('heapish-format');
                } else {
                    $item.data('heapish-format', format);
                }

                $item.addClass('heapish-' + $item.data('heapish-format')).attr('data-heapish-index', heap.length);

                heap.push({
                    format: format,
                    reference: $item
                });
            });
        };

        if (settings && settings.data && $.isArray(settings.data) && settings.data.length) {
            $.each(settings.data, function(index, item) {
                if (item.content) {

                    var $item = $("<div></div>").html(item.content);
                    var format = item.format ? cleanFormat(item.format) : settings.defaultFormat;

					// If any additional data was passed along, attach it to the reference
					if (item.data && $.isPlainObject(item.data)) $item.data(item.data);

                    $item.data('heapish-format', format).addClass('heapish-' + format).attr('data-heapish-index', heap.length);

                    heap.push({
                        format: format,
                        reference: $item
                    });

                    $item.appendTo($el);
                }
            });

        };

		/* The ruler is used to accurately measure the inside width of the heap, as
		 * items like in-element scrollbars will cause $el.width and $el.innerWidth
		 * to be reported incorrectly (or rather, correctly, but with an unusable
		 * portion).  It's only needed if you plan to have your
		 * heap be vertically scrollable - a fixed height, for example.
		 */
		if (settings.useRuler) {
			$ruler = $("<div>").addClass('heapish-ruler').appendTo($el);
		}

		heapOrder = Array.apply(0, Array(heap.length)).map(function(_,i) { return i; });
		organize();

        ready = true;

		$el.trigger("heapish-ready");
    };

	/* Defaults
	 *
	 * A simple object containing heapish's required configuration values.
	 * Can be extended by passing a similar object as an argument when
	 * .heapish() is initially called.
	 */

    $.fn.heapish.defaults = {
        uniqueClass: 'heapish',
        defaultFormat: 'box',
        data: [],
		paddingV: 15,
		paddingH: 15,
		useRuler: false,
		allowRemovalWhileEditing: true
    };

    /* organize
	 *
	 * This does all of the heavy lifting - that is, attempting to
	 * sort boxes to best optimize available space, while respecting
	 * display order as much as possible, and setting margins so
	 * boxes appear to use space more efficiently than they do.
	 *
	 * Pass always=true if you need Organize to fire even while stopped
	 */
	var organize = $.fn.heapish.organize = function(always) {
		if (stopped && (always == undefined || !always)) return;

		$el.trigger("heapish-organizing");

		// determine the physical width of the heap
		if (settings.useRuler) {
			var heapWidth = $ruler.width();
		} else {
			var heapWidth = $el.innerWidth();
		}

		var row = {indexes: [], width: 0, isRow: false};
		var rows = [];

		var lastRowTop = heap[0].reference.position().top;

		var smallestBoxWidth = heapWidth; // lies!

		// determine the dimensions of every box in the heap before we futz with anything, and build a row array
		for (var i=0; i < heapOrder.length; i++) {
			var index = heapOrder[i];

			var top = heap[index].reference.position().top;

			// Our elevation has changed, we're on a new row
			if (top !== lastRowTop) {
				// push the current row out and keep building
				rows.push(row);
				var row = {indexes: [], width: 0, isRow: false};
				lastRowTop = top;
			}

			if (row.top == undefined) row.top = top;
			row.indexes.push(index);

			heap[index].width = heap[index].reference.width();
			heap[index].height = heap[index].reference.height();

			row.width = row.width + heap[index].width;

			// We don't care to compare row-format boxes! They should all be 100% wide
			if (heap[index].reference.data('heapish-format') == 'row') {
				// flag this row as containing a row-format box
				row.isRow = true;
			} else {
				if (heap[index].width < smallestBoxWidth) smallestBoxWidth = heap[index].width;
			}

			heap[index].row = rows.length;
		};

		// tack the last row on
		rows.push(row);

		// the true space required if we relocate that tiniest box
		smallestBoxWidth += settings.paddingH; 
		
		// for each row, determine how much wasted space there is
		$.each(rows, function(index) {

			// Skip the last Row, Rows containing only Row-format objects, and Rows with no items left
			if (index == rows.length - 1) return;
			if (rows[index].isRow) return;
			if (!rows[index].indexes.length) return;

			var padding = (Math.max(rows[index].indexes.length - 1, 0)) * settings.paddingH;
			var wasted = heapWidth - rows[index].width - padding;

			// If there's not enough space for even the smallest box, skip this row
			if (wasted < smallestBoxWidth) return;

			// Iterate over all rows following this one
			for (var i = index+1; i < rows.length; i++) {
				// Again skip rows only containing a Row-format object
				if (rows[i].isRow) continue;

				// Iterate the boxes in the row
				for (var j = 0; j < rows[i].indexes.length; j++) {
					var k = rows[i].indexes[j]; // just for easier access
					if (k == undefined || !heap[k]) continue;

					// Compute the space needed for this box
					var delta = heap[k].width + settings.paddingH;
					if (delta < wasted) {
						// We've found a box to move! So move it
						rows[index].indexes.push(k);
						rows[i].indexes.splice(j,1);
						j--;

						// And update the widths accordingly
						rows[index].width += delta;
						rows[i].width -= delta;
						wasted = wasted - delta;

						// Update the row metadata on the heap
						heap[k].row = index;
					};
				};
			};
		
		});

		// Build our new linear order from the rows, and mark our End-of-Line objects
		var newHeapOrder = [];
		var eolIndexes = [];
		for (var i = 0; i < rows.length; i++) {
			var j = 0;
			for (; j < rows[i].indexes.length; j++) {
				if (rows[i].indexes[j] !== undefined) newHeapOrder.push(rows[i].indexes[j]);
			}
			eolIndexes.push(rows[i].indexes[j-1]);
		}

		// all this work for nothing!
		if (newHeapOrder == heapOrder) return;

		// update our end-of-line classes
		$.each(heap, function(index) {
			if (eolIndexes.indexOf(index) !== -1) {
				heap[index].reference.addClass('heapish-eol');
			} else {
				heap[index].reference.removeClass('heapish-eol');
			}
		});

		// Detach elements and reattach to the heap in the new order
		for (var i = 0; i < newHeapOrder.length; i++) {
			var index = newHeapOrder[i];
			heap[index].reference.detach().appendTo($el).css('margin-bottom', settings.paddingV);

			heap[index].order = i;

			// Add the minimum right margin to all items, save EOLs and Row-formats.
			if (heap[index].format != 'row' && eolIndexes.indexOf(index) == -1) {
				heap[index].reference.css('margin-right', settings.paddingH);
			} else {
				// Make sure EOLs and Row-formats don't have right margins
				heap[index].reference.css('margin-right', 0);
			}
		};

		// Redistribute whitespace
		for (var index = 0; index < rows.length; index++) {
			// Get the new "wasted", without padding included
			var row = rows[index];

			// Empty rows, or Row-format rows can be skipped
			if (!row.indexes.length || row.isRow) continue;

			// Recalculate the wasted space - which now excludes padding
			if (settings.useRuler) {
				// The ruler may have changed size if resorting caused a scrollbar to disappear
				var wasted = $ruler.width();
			} else {
				var wasted = heapWidth;
			}

			for (var i = 0; i < row.indexes.length; i++) {
				wasted -= heap[row.indexes[i]].reference.width();
			}

			// Single-box rows don't need any margin-fudging magic
			if (row.indexes.length > 1) {

				var gap = Math.floor(wasted / (row.indexes.length - 1));
				var gapRemaining = wasted;
	
				for (var i = 0; i < row.indexes.length - 2; i++) {
					heap[row.indexes[i]].reference.css('margin-right', gap);
					gapRemaining -= gap;
				};
	
				// The second-last item in the row might have a slightly larger margin to accomodate sub-pixel rounding
				heap[row.indexes[row.indexes.length - 2]].reference.css('margin-right', gapRemaining);

			}
		};

		// Make our new order known
		heapOrder = newHeapOrder;

		// Refresh Meta or Edit modes
		if (showingMeta) showMeta();
		if (editMode) {
			console.log("Organize calling startEditing");
			startEditing();
		}

		$el.trigger("heapish-organized");
    };

    /* quick helper to make sure supplied formats are valid
    */
	var cleanFormat = function(format) {
        return $.inArray(format, validFormats) ? format : settings.defaultFormat;
    }

    /* Push
	 *
	 * Adds a new item to the heap.  The content argument can be a string, a
	 * jQuery object, or a plain object of the following format:
	 * {content: (string|jQuery object), format: string, data: plain object}
	 *
	 * Only content is required - format will fallback to the default setting
	 * if none is provided.
	 *
	 * beforeIndex optionally allows the item to be injected somewhere within
	 * the heap, rather than appended to it.
	 *
	 * Silent optionally prevents syncHeap() and organize() calls.
	 */
	$.fn.heapish.push = function(content, format, beforeIndex, silent) {
		$el.trigger("heapish-push", content, format, beforeIndex);

        // beforeIndex is an optional argument - we'll push to the bottom if not defined
        if (beforeIndex === undefined)  beforeIndex = -1;

        var pushable = {
            format: settings.defaultFormat,
            reference: false
        };

		if (format && (typeof format == 'string' || format instanceof String)) {
            pushable.format = cleanFormat(format);
		} else if (content.format) {
            // in case an object was handed in as the first param
			pushable.format = cleanFormat(content.format);
		}

        content = (content.content ? content.content : false) || content || "";

        if (content && content instanceof jQuery) {
            pushable.reference = content;
        } else {
            pushable.reference = $("<div>").html(content || "");
        }

		if (content.data && $.isPlainObject(content.data)) pushable.reference.data(content.data);

        pushable.reference.addClass('heapish-' + pushable.format).data('heapish-format', pushable.format).attr('data-heapish-index', heap.length);

		heap.push(pushable);
        if (beforeIndex === -1) {
			heapOrder.push(heap.length - 1);
        } else {
			heapOrder.splice(beforeIndex, 0, heap.length - 1)
        }

		// Needs to exist in the DOM so it can have dimensions
		$el.append(pushable.reference);

		if (silent == undefined || !silent) {
			syncHeap();
			organize(true);
		}
    };

	/* Pop
	 *
	 * Convenience function, removes last item from heap. Same as remove(-1);
	 */
    $.fn.heapish.pop = function(silent) {
		if (!ready) return;

        remove(-1, silent);
    };

    /* Remove
	 *
	 * Removes an item from the heap by index.
	 * If the silent argument is not explicitly passed, also fires
	 * syncHeap() and organize(), regardless of stopped state.
	 *
	 * If index is negative, removes from the end of the heap (-1 for last,
	 * -2 for second last, etc)
	 */
	var remove = $.fn.heapish.remove = function(index, silent) {
		if (!ready) return;

		if (index < 0) index == heap.length + index;

        if (heap[index]) {
			$el.trigger("heapish-remove", heap[index]);

			$el.find('[data-heapish-index="' + index + '"]').remove();
            heap.splice(index, 1);
			heapOrder.splice(heapOrder.indexOf(index), 1);

			$.each(heap, function(index) {
				heap[index].reference.attr('data-heapish-index', index);
			});

			for (var i = 0; i < heapOrder.length; i++) {
				if (heapOrder[i] > index) {
					heapOrder[i] = heapOrder[i] - 1;
				}
			}

			if (silent == undefined || !silent) {
				syncHeap();
				organize(true);
			}
        }
    };

    /* Data
	 *
	 * Returns the current heap.
	 */
	$.fn.heapish.data = function() {
		if (!ready) return;

		return heap;
    };

	/* Stop Heapish
	 *
	 * This really just prevents automatic organize() calls from happening.
	 * If items are pushed or removed while in the stopped state, organize()
	 * will still fire (unless they're explicitly passed a 'silent' param)
	 */
	var stop = $.fn.heapish.stop = function() {
		if (!ready) return;

		if (!stopped) {
			stopped = true;
			$el.trigger("heapish-stop");
		}
	};

	/* Go
	 *
	 * Resume Heapish from a stopped state. Automatically calls Organize.
	 */
	var go = $.fn.heapish.go = function(silent) {
		if (!ready) return;

		if (stopped) {
			stopped = false;
			$el.trigger("heapish-go");
			if (silent == undefined || !silent) organize();
		}
	};

	/* Hide Meta
	 *
	 * Closes the Meta Overlay UI
	 */
	var hideMeta = $.fn.heapish.hideMeta = function() {
		if (!ready) return;

		if (!showingMeta || editMode) return;
		$el.trigger("heapish-meta-hide");
		$el.find('.heapish-matte').remove();
		showingMeta = false;
		go(true);
	};

	/* Show Meta
	 *
	 * Opens an overlay UI that shows heapish data for each item such as
	 * index, row, format, etc.  Cannot be opened while in Edit Mode.
	 */
	var showMeta = $.fn.heapish.showMeta = function() {
		if (!ready) return;

		// Don't allow meta to be shown while in edit mode
		if (editMode) return;

		// If showMeta is called while already active, refresh it
		if (showingMeta) hideMeta();

		$el.trigger("heapish-meta-show");
		stop();

		$matte = $('<div>').addClass('heapish-matte').appendTo($el);
		showingMeta = true;

		$matte.click(hideMeta);

		for (var i = 0; i < heap.length; i++) {
			var offset = heap[i].reference.position();
			var width = heap[i].reference.width();
			var height = heap[i].reference.height();

			var $meta = $("<div>").addClass("heapish-meta").css({
				left: offset.left,
				top: offset.top,
				width: width,
				height: height
			});

			var $metaData = $("<div>").addClass("heapish-meta-inner")
				.html(
					"<strong>Row:</strong>" + heap[i].row + "<br/>" +
					"<strong>Index:</strong>" + i + "<br/>" +
					"<strong>Order:</strong>" + heap[i].order + "<br/>" +
					"<strong>Class:</strong>" + heap[i].reference.attr('class') + "<br/>" +
					"<strong>Format:</strong>" + heap[i].format + "<br/>" + 
					"<strong>Size:</strong>" + width + "x" + height + "<br/>"
				).appendTo($meta);

			$meta.appendTo($matte);
		}
	};

	/* Move
	 *
	 * index: the index of the item to be moved within the heap
	 * heapPosition: the new position within the heap
	 * 	- 0 for beginning of heap, etc
	 * 	- -1 can be passed to specify end of the heap
	 * 
	 */
	var move = $.fn.heapish.move = function(index, heapPosition) {
		if (!ready) return;

		var curPos = heapOrder.indexOf(index);
		if (curPos == -1) return; // How did you do that?

		$el.trigger("heapish-move", heap[index], heapPosition);

		heapOrder.splice(curPos, 1);
		if (heapPosition == -1) {
			heapOrder.push(index);
		} else {
			heapOrder.splice(heapPosition, 0, index);
		}

		syncHeap();
		organize(true);
	};

	/* Sync Heap
	 *
	 * Put the Dom Elements in Heap Order
	 */
	var syncHeap = $.fn.heapish.syncHeap = function() {
		if (!ready) return;

		$el.trigger("heapish-syncing");
		var newHeap = [];
		for (var i = 0; i < heapOrder.length; i++) {
			newHeap.push(heap[heapOrder[i]]);
			newHeap[i].reference.attr('data-heapish-index', i);
		}
		heap = newHeap;
		heapOrder = Array.apply(0, Array(heap.length)).map(function(_,i) { return i; });
		$el.trigger("heapish-synced");
	};

	/* Finish Editing
	 *
	 * Edit Mode cleanup function - also triggers heapish-edited event
	 */
	var finishEditing = $.fn.heapish.finishEditing = function() {
		if (!ready) return;

		if (!editMode) return;
		$el.find('.heapish-matte').remove();
		editMode = false;

		go(true);

		$el.trigger("heapish-edited", heap);
	};

	/* Start Editing
	 *
	 * Creates the Editor Overlay, Move & Remove buttons, and all of the action handlers therefore.
	 *
	 * Note that it does NOT provide a "Finish Editing" button - you'll want to handle this in your
	 * own interface, just like the Start Editing button.
	 */
	var startEditing = $.fn.heapish.startEditing = function() {
		if (!ready) return;

		// If meta is being shown, blow it away - edit mode wins
		if (showingMeta) hideMeta();

		// Called if Refreshing Edit Mode due to a change (push/remove)
		if (editMode) {
			// Refreshes Edit Mode (finishes current edit session, then continues setting up again)
			$el.trigger("heapish-editing-refresh");
			finishEditing(true);
		} else {
			$el.trigger("heapish-editing");
		}

		stop();

		$matte = $('<div>').addClass('heapish-matte').appendTo($el);
		editMode = true;

		for (var i = 0; i < heapOrder.length; i++) {
			var h = heap[heapOrder[i]];

			var offset = h.reference.position();
			var width = h.reference.width();
			var height = h.reference.height();
		
			var $overlay = $("<div>").addClass("heapish-edit-overlay").css({
				left: offset.left,
				top: offset.top,
				width: width,
				height: height
			});

			var $controls = $("<div>").addClass("heapish-edit-controls").appendTo($overlay);

			// If it's a Row, it needs up/down buttons
			if (h.format == "row") {
				// NOTE: Consider hiding Up button when Row = 0, Down when Row = rows.length - 1
				// May be able to do that entirely with CSS, however

				var $up = $("<div>").addClass("control up").click(
					function() {
						var index = heapOrder[$(this).data('index')];

						var currentRow = heap[index].row;
						if (currentRow == 0) return;
						var targetRow = currentRow - 1;

						// Find the first element in the heap matching Target Row
						for (var j = 0; j < heapOrder.length; j++) {
							if (heap[heapOrder[j]].row == targetRow) {
								move(index, j);
								break;
							}
						}
					}
				).appendTo($controls).data('index', i);

				var $down = $("<div>").addClass("control down").click(
					function() {
						var index = heapOrder[$(this).data('index')];

						var currentRow = heap[index].row;
						if (currentRow == heap[heapOrder[heapOrder.length - 1]].row) return;
						var targetRow = currentRow + 1;

						// Find the LAST element in the heap matching Target Row
						for (var j = heapOrder.length - 1; j > 0; j--) {
							if (heap[heapOrder[j]].row == targetRow) {
								move(index, j);
								break;
							}
						}
					}
				).appendTo($controls).data('index', i);

			// Otherwise, it needs Left/Right buttons
			} else {

				var $left = $("<div>").addClass("control left").click(
					function() {
						var index = $(this).data('index');

						if (index == 0) return;
						move(index, index - 1);
					}
				).appendTo($controls).data('index', i);

				var $right = $("<div>").addClass("control right").click(
					function() {
						var index = $(this).data('index');
						
						if (index == heapOrder.length - 1) return;
						move(index, index + 1);
					}
				).appendTo($controls).data('index', i);

			}

			// In any case, we need a Remove button - if allowed
			if (settings.allowRemovalWhileEditing) {
				var $remove = $("<div>").addClass("control remove").click(
					function() {
						var index = heapOrder[$(this).data('index')];
						
					}
				).appendTo($controls).data('index', $(this).data('index'));
			}

			$overlay.appendTo($matte);
		}

	};

	// Small helper function to return various heapish states
	$.fn.heapish.states = function() {
		return {
			'ready': ready,
			'stopped': stopped,
			'meta': showingMeta,
			'edit': editMode
		}
	};

}));