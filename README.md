Heapish
=======

A jQuery Plugin for generating semi-self-sorting heaps of content.


What does it do?
----------------

Heapish creates a "heap" of content, made up of elements in two formats: boxes,
and rows. It was purpose-built to help manage Dashboard Widgets in an
application, which contain both full-width items such as graphs and tables
(Rows), and smaller items such as pie charts or small bits of data (Boxes).

Heapish attempts to organize the Boxes into as few rows as possible, while
respecting the implied order of the content as much as possible.

Imagine a Container that's 800px wide, containing 4 elements:
- Row 1 contains two boxes, each 200px by 200px.
- Row 2 contains a full-width table
- Row 3 contains another box, also 200px by 200px.

Handed over to Heapish, the box in the third row would be moved to the end of
the first row, and the third row would be removed.


Settings
--------

The default Settings object is as follows:
```javascript
    $.fn.heapish.defaults = {
        uniqueClass: 'heapish',
        defaultFormat: 'box',
        data: [],
		paddingV: 15,
		paddingH: 15,
		useRuler: false,
		allowRemovalWhileEditing: true
    };
```

This defaults object can be overwritten before calling heapish, if desired, or
specific options can be provided when `heapish()` is first called.

__uniqueClass__: the Class added to the element `heapish()` is called against.

__defaultFormat__: the format new content should be given when none is
specified. Should be either 'box' or 'row'.

__data__: an array of content to be added automatically to the heap. Each object
in the array should have the following form:

```javascript
{
    content: "<p>Some HTML here</p>", // OR
    content: $("#some_jquery_object"),
    format: 'box', // optional, defaults to _defaultFormat_
    data: {foo: 'bar'} // optional, added to the resulting DOM object as data attributes
}
```

__paddingV__: The amount of vertical space between rows in the heap.

__paddingH__: The _minimum_ amount of horizontal space between boxes in the
heap.

__useRuler__: if `true`, a hidden ruler object is added to the heap and used to
calculate width. If you expect your heap to have a vertical scrollbar (container
of a fixed size with overflow: scroll, for example) set this to true. In most
cases, it's not needed.

__allowRemovalWhileEditing__: by default, when entering Edit Mode each item in
the heap is displayed with arrows to control its position, and a red X button
to allow the item to be removed.  This prevents that removal button from being
rendered.


Functions
---------

__.heapish(options)__

__Usage:__ `$('#heap').heapish({useRuler: true});`

This initializes Heapish. If the target element already contains content, each
element is added to the Heap. 

_options_ takes the form of the settings object described above. Alternatively,
any other heapish function can be called by passing its name as the options
argument, ie: `.heapish("stop");`


__.heapish.organize(always)__

__Usage:__ `$('#heap').heapish.organize();`

This manually invokes the organize function. If you've changed the contents of
an item in the heap, you may want to call this.

If `true`, _always_ forces `organize()` to fire even if heapish is in a stopped
state.


__.heapish.push(content, format, beforeIndex, silent)__

__Usage:__ `$('#heap').heapish.push("<div>New Heap Item</div>", "box");`

This adds a new item to the Heap.

_content_ may be an HTML string or jQuery object. It may also be an object of
the same format accepted by `settings.data`

_format_, if provided, should be either 'box' or 'row', defaulting to
`settings.defaultFormat` if neither is supplied. If both _content.format_ and
_format_ are supplied, _format_ will be used.

_beforeIndex_, if provided, will insert the new item into the heap at the given
index. If omitted or set to -1, the item will be appended to the end of the
heap.

_silent_, if provided, will prevent `syncHeap()` and `organize()` from being
fired. This can be useful if you intend to add multiple items, as it will
greatly reduce the number of DOM-modifying events being triggered.


__.heapish.remove(index, silent)__

__Usage:__ `$('#heap').heapish.remove(5);`

This removes an item from the Heap.

_index_ is the numerical index in the heap of the item to be removed.  If
_index_ is provided as a negative number, the item is removed from the end
of the heap (-1 for the last item, -2 for second last, etc)

_silent_, if provided, will prevent `syncHeap()` and `organize()` from being
fired. This can be useful if you intend to remove multiple items, as it will
greatly reduce the number of DOM-modifying events being triggered.


__.heapish.pop(silent)__

__Usage:__ `$('#heap').heapish.pop();`

The removes the last item from the Heap. It's simply a shorthand for
`heapish.remove(-1)`.

_silent_, if provided, will prevent `syncHeap()` and `organize()` from being
fired. This can be useful if you intend to remove multiple items, as it will
greatly reduce the number of DOM-modifying events being triggered.


__.heapish.data()__

__Usage:__ `$('#heap').heapish.data();`

Returns the array of data representing the current Heap.  If you're planning to
persist the order of elements to a database or something similar, you'll want
to call this function and iterate the response.


__.heapish.stop()__

__Usage:__ `$.('#heap').heapish.stop();`

While _stopped_, heapish will not fire automatic `organize()` events.


__.heapish.go()__

__Usage:__ `$.('#heap').heapish.go();`

Clears the _stopped_ state, resuming normal automatic `organize()` events.


__.heapish.showMeta()__

__Usage:__ `$.('#heap').heapish.showMeta();`

Creates a Meta-data overlay which displays information about heap items such as
the computed row and index, dimensions, etc.  Meant as a Developer Debug tool.

If called while already in this mode, it ends the previous showMeta session and
begins a new one.


__.heapish.hideMeta()__

__Usage:__ `$.('#heap').heapish.hideMeta();`

Ends the running showMeta session, if one is present. The meta overlay can also
be dismissed by simply clicking on it.


__.heapish.move(index, heapPosition)__

__Usage:__ `$.('#heap').heapish.move(5, 2);`

Relocates an item within the Heap.

_index_ is the numerical index in the heap of the item to be moved.

_heapPosition_ is the new position desired within the heap.  If given as -1,
the item is moved to the back of the heap.

__NOTE__ that `.move()` has no silent option - `syncHeap()` and `organize()`
are always called as a result of using `.move()`.


__.heapish.syncHeap()__

__Usage:__ `$.('#heap').heapish.syncHeap();`

Synchronizes the DOM order with the understood Heap order.  If you ever have to
manually called `.organize()` consider calling this first as well.


__.heapish.startEditing()__

__Usage:__ `$.('#heap').heapish.startEditing();`

Enters the Heapish Edit mode. __Box__ format items are given Left/Right
controls, while __Row__ format items are given Up/Down controls.  Assuming
`settings.allowRemovalWhileEditing` is true, all items also receive a Remove
control.


__.heapish.finishEditing()__

__Usage:__ `$.('#heap').heapish.finishEditing();`

Closes the Editing overlay and leaves Edit Mode.


__.heapish.states()__

__Usage:__ `$.('#heap').heapish.states();`

Returns an object containing information about the various states of the heap;
_ready_, _stopped_, _meta_ and _edit_ (the last two indicating that showMeta or
startEditing have been called, respectively).



Events
------

__heapish-initializing:__ Triggered when heapish() is first called.

__heapish-ready:__ Triggered when heapish() completes setup.

__heapish-organizing:__ Triggered when heapish.organize() begins.

__heapish-organized:__ Triggered when heapish.organized() completes.

__heapish-push:__ Triggered when heapish.push() begins. Supplies the content,
format, and beforeIndex parameters given to `push()` as arguments.

__heapish-remove:__ Triggered when heapish.remove() begins. Supplies the heap item
being removed as an argument.

__heapish-stop:__ Triggered when heapish.stop() is called.

__heapish-go:__ Triggered when heapish.go() is called.

__heapish-meta-show:__ Triggered when heapish.showMeta() is called.

__heapish-meta-hide:__ Triggered when heapish.hideMeta() is called.

__heapish-move:__ Triggered when heapish.move() is called. Supplies heap item
being moved, and the new heap position it is being moved to as arguments.

__heapish-editing:__ Triggered when heapish.startEditing() is called.

__heapish-editing-refresh:__ Triggered when heapish.startEditing() is called
while already in Edit Mode.

__heapish-edited:__ Triggered when heapish.finishEditing() is called. Supplies
the heap as an argument.


FAQ
---

No one has asked any questions yet!


