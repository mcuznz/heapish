$(function() {
    $('#heapContainer').heapish();
    $('#triggerResize').click(function() {
        //$(window).trigger('resize');
        $('#heapContainer').heapish.organize();
    });

    $('#pop').click(function() {
        $('#heapContainer').heapish.pop();
    });

    $('#meta').click(function() {
        $('#heapContainer').heapish.showMeta();
    });

    $('#getData').click(function() {
        console.log($('#heapContainer').heapish.data());
    });

    var removeIt = function() {
        $('#heapContainer').heapish.remove($(this).data('heapish-index'));
    };

    $(document).on('click', '.heapish-box', removeIt);
    $(document).on('click', '.heapish-row', removeIt);

    $('#addBox').click(function() {
        var style = Math.ceil(Math.random() * 5);
        var codePath = Math.ceil(Math.random() * 4);
 
        switch (codePath) {
            case 1:
                console.log("Path 1, one argument push (content string)");
                $('#heapContainer').heapish.push('<div class="box' + style + '">Dynamic Box ' + style + '-' + codePath + '</div>');
                break;

            case 2:
                console.log("Path 2, one argument push (content jQuery obj)");
                var doodad = $("<div></div>").html('<strong>Dynamic Box ' + style + '-' + codePath + '</strong>').addClass('box' + style);
                $('#heapContainer').heapish.push(doodad);
                break;

            case 3:
                console.log("Path 3, one argument push (Object with 2 properties)");
                var doodad = $("<div></div>").html('<strong>Dynamic Box ' + style + '-' + codePath + '</strong>').addClass('box' + style);
                $('#heapContainer').heapish.push({format: 'box', content: doodad});
                break;

            case 4:
                console.log("Path 4, two argument push (content jQuery obj)");
                var doodad = $("<div></div>").html('<strong>Dynamic Box ' + style + '-' + codePath + '</strong>').addClass('box' + style);
                $('#heapContainer').heapish.push(doodad, 'box');
                break;

        }
    });
    $('#addRow').click(function() {
        var style = Math.ceil(Math.random() * 3);
        var codePath = Math.ceil(Math.random() * 2);
 
        switch (codePath) {
            case 1:
                console.log("Path 1, one argument push (Object with 2 properties)");
                var doodad = $("<div></div>").html('<strong>Dynamic Row ' + style + '-' + codePath + '</strong>').addClass('row' + style);
                $('#heapContainer').heapish.push({format: 'row', content: doodad});
                break;

            case 2:
                console.log("Path 2, two argument push (content jQuery obj)");
                var doodad = $("<div></div>").html('<strong>Dynamic Row ' + style + '-' + codePath + '</strong>').addClass('row' + style);
                $('#heapContainer').heapish.push(doodad, 'row');
                break;

        }
    });    
});