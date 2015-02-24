(function($) {
  $.widget('pathrings.tickslider', $.ui.slider, {
    options: {tick: false},
    _create: function() {
			var i, background,
					min = this.options.min,
					max = this.options.max,
					width = max - min;

      this._super();
      if (!this.options.tick) {return;}

			for (i = this.options.min; i <= this.options.max; i += this.options.tick) {
        $('<div/>').appendTo(this.element).css({
					left: (100 * (i - min) / width).toFixed(2) + '%',
					background: '#444', 'z-index': -1,
					position: 'absolute', top: '12px', width: '2px', height: '8px'});
				/*
        $('<div>' + i + '</div>').appendTo(this.element).css({
					left: (100 * (i - min) / width).toFixed(2) + '%',
					'z-index': -1, 'text-align': 'center',
					position: 'absolute', top: '12px', width: '0px', height: '8px'});
				*/
			}}
  });
})($);