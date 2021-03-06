/**
 * @author      Yongnan
 * @version     1.0
 * @time        9/17/2014
 * @name        PathBubbles_text
 */
var $P = PATHBUBBLES;

$P.Text = $P.defineClass(
	$P.Object2D,
	function (config) {
		$P.Object2D.call(this, config);
    this.fillStyle = config.fillStyle || '#000';
    this.text = config.text || '';
		this.fontSize = config.fontSize || 20;
		this.fontBase = config.fontBase || function(size) {return size + 'pt Calibri';};
    this.textAlign = config.textAlign || 'center';
    this.textBaseline = config.textBaseline || 'middle';},
	{
		/** Sets context to use this text's font style. */
		setFont: function(context, scale) {
			context.font = this.fontBase(Math.round(this.fontSize * scale));},
    drawSelf: function (ctx, scale) {
      // textAlign aligns text horizontally relative to placement
      ctx.textAlign = this.textAlign;
      // textBaseline aligns text vertically relative to font style
      ctx.textBaseline = this.textBaseline;
      ctx.fillStyle = this.fillStyle;
			this.setFont(ctx, scale);
      ctx.fillText(this.text, this.x * scale, this.y * scale);},
    drawWrapText: function (ctx, maxWidth, lineHeight) {
			throw new Error('unfinished');
      ctx.font = this.font;
      // textAlign aligns text horizontally relative to placement
      ctx.textAlign = this.textAlign;
      // textBaseline aligns text vertically relative to font style
      ctx.textBaseline = this.textBaseline;
      ctx.fillStyle = this.fillColor;
      var cars = this.text.split("\n");
      for (var ii = 0; ii < cars.length; ii++) {
        var line = "";
        var words = cars[ii].split(" ");
        for (var n = 0; n < words.length; n++) {
          var testLine = line + words[n] + " ";
          var metrics = ctx.measureText(testLine);
          var testWidth = metrics.width;
          if (testWidth > maxWidth) {
            ctx.fillText(line, x, y);
            line = words[n] + " ";
            y += lineHeight;
          }
          else {
            line = testLine;
          }
        }
        ctx.fillText(line, x, y);
        y += lineHeight;
      }
    },
    getTextHeight: function (ctx, scale) {return this.fontSize * scale;},
    getTextWidth: function (ctx, scale) {
			this.setFont(ctx, scale);
      return ctx.measureText(this.text).width;},
		/**
		 * Pick a font size that fits within the given area.
		 */
		pickFontSize: function(ctx, scale, width, min, max) {
			for (this.fontSize = max; this.fontSize > min; --this.fontSize) {
				if (this.getTextWidth(ctx, scale) <= width) {return;}}
			return;}
	});
