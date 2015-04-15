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
    var ready = false;
    var settings = {};
    var $el;
    var validFormats = ['box', 'row'];
	var heapOrder = [];
	var stopped = false;
	var showingMeta = false;

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
			} else {
				$(this).heapish.stop();
			}
			return;
		}

        if (ready && options && (typeof options == 'string' || options instanceof String) && $.isFunction($(this).heapish[options] )) {
            // call the supplied function and get out of dodge
            $(this).heapish[options].apply(this, args);
            return;
        }

        $el = $(this);
        if (options && $.isPlainObject(options)) {
			settings = $.extend({}, $.fn.heapish.defaults, options);
		} else {
			settings = $.extend({}, $.fn.heapish.defaults);
		}

        $el.addClass(settings.uniqueClass || 'heapish');

        var debounced = debounce(organize, 250);
		$(window).resize(debounced);

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

                    $item.data('heapish-format', format).addClass('heapish-' + format).attr('data-heapish-index', heap.length);

                    heap.push({
                        format: format,
                        reference: $item
                    });

                    $item.appendTo($el);
                }
            });

        };

		heapOrder = Array.apply(0, Array(heap.length)).map(function(_,i) { return i; });
		organize();

		//$el.css('margin-bottom', (0 - settings.paddingH) + "px");

        ready = true;
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
		paddingH: 15
    };

    /* organize
	 *
	 * This does all of the heavy lifting - that is, attempting to
	 * sort boxes to best optimize available space, while respecting
	 * display order as much as possible, and setting margins so
	 * boxes appear to use space more efficiently than they do.
	 */
	var organize = $.fn.heapish.organize = function() {
		if (stopped) return;

		// determine the physical width of the heap
		var heapWidth = $el.width();

		var row = {indexes: [], width: 0, isRow: false};
		var rows = [];

		var lastRowTop = heap[0].reference.position().top;

		var smallestBoxWidth = heapWidth; // lies!

		// determine the dimensions of every box in the heap before we futz with anything, and build a row array
		for (var index=0; index<heap.length; index++) {
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

			// Add the minimum right margin to all items, save EOLs and Row-formats.
			if (heap[index].format != 'row' && eolIndexes.indexOf(index) == -1) {
				heap[index].reference.css('margin-right', settings.paddingH);
			} else {
				// Make sure EOLs and Row-formats don't have right margins
				heap[index].reference.css('margin-right', 0);
			}
		};

		// Finally, redistribute whitespace
		for (var index = 0; index < rows.length; index++) {
			// Get the new "wasted", without padding included
			var row = rows[index];

			// Empty rows, or Row-format rows can be skipped
			if (!row.indexes.length || row.isRow) continue;

			// Recalculate the wasted space - which now excludes padding
			var wasted = heapWidth;
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

    };

    /* quick helper to make sure supplied formats are valid
    */
	var cleanFormat = function(format) {
        return $.inArray(format, validFormats) ? format : settings.defaultFormat;
    }

    /* push:
	 *
	 * (left off here)
	 */
	$.fn.heapish.push = function(content, format, beforeIndex) {
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

        pushable.reference.addClass('heapish-' + pushable.format).data('heapish-format', pushable.format).attr('data-heapish-index', heap.length);

        if (beforeIndex !== -1) {
            heap.splice(beforeIndex, 0, pushable);
        } else {
            heap.push(pushable);
        }

		// Needs to exist in the DOM so it can have dimensions
		$el.append(pushable.reference);

        organize();

		if (showingMeta) showMeta();
    };

    $.fn.heapish.pop = function(silent) {
        remove(heap.length - 1, silent);
    };

    var remove = $.fn.heapish.remove = function(index, silent) {
        if (heap[index]) {
			$el.find('[data-heapish-index="' + index + '"]').remove();
            heap.splice(index, 1);

			$.each(heap, function(index) {
				heap[index].reference.attr('data-heapish-index', index);
			});

			if (!silent || silent == undefined) organize();

			if (showingMeta) showMeta();
        }
    };

    $.fn.heapish.data = function(data) {
        if (!data) return heap;

        // do something if parameters are passed?
    }

	var stop = $.fn.heapish.stop = function() {
		if (!stopped) stopped = true;
	}

	var go = $.fn.heapish.go = function(silent) {
		if (stopped) {
			stopped = false;
			if (silent !== undefined && silent) organize();
		}
	}

	var hideMeta = $.fn.heapish.hideMeta = function() {
		if (!showingMeta) return;
		$el.find('.heapish-matte').remove();
		showingMeta = false;
		go(true);
	};

	var showMeta = $.fn.heapish.showMeta = function(remove) {
		if (showingMeta) hideMeta();

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
					"<strong>Class:</strong>" + heap[i].reference.attr('class') + "<br/>" +
					"<strong>Format:</strong>" + heap[i].format + "<br/>" + 
					"<strong>Right Margin:</strong>" + heap[i].reference.css('margin-right') + "<br/>" +
					"<strong>Size:</strong>" + width + "x" + height + "<br/>"
				).appendTo($meta);

			$meta.appendTo($matte);
		}
	};

	

}));