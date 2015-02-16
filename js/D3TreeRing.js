/**
 * @author      Yongnan
 * @version     1.0
 * @time        10/10/2014
 * @name        PathBubble_D3Ring
 */

var $P = PATHBUBBLES;

$P.D3TreeRing = $P.defineClass(
	$P.HtmlObject,
	function D3TreeRing(config) {
		$P.HtmlObject.call(this, {
			parent: '#bubble',
			type: 'div',
			pointer: 'auto',
			objectConfig: config});

		this.defaultRadius = config.defaultRadius;
		this.name = config.name || '';
		this.dataType = config.dataType;
		this.file = config.filename || ('./data/Ortholog/' + this.dataType + '/' + this.name + '.json');
		this.customOrtholog = config.customOrtholog;
		this.selectedData = null;
		this.showCrossTalkLevel = config.crosstalkLevel || this.parent.crossTalkLevel || 1;
		this.changeLevel = config.changeLevel || false;
		this.customExpression = config.customExpression || null;
		this.expressionScaleMax = null;
		this.maxLevel = 6;
		this._crossTalkSymbols = {};
		this._rateLimitSymbols = {};
		this.highlightPathways = config.highlightPathways || [];
		if (config.showTitle) {this.showTitle();}
		else if (config.showCrossTalk) {this.showCrossTalk();}},
	{
		init: function () {
			var treeRing = this,
					bubble = this.parent;

			var _this = this;
			var width = this.defaultRadius,
					height = this.defaultRadius,
					radius = Math.min(width, height) / 2;
			var x = d3.scale.linear()
						.range([0, 2 * Math.PI]);

			var y = d3.scale.sqrt()
						.range([0, radius]);

			var svg = d3.select(this.element).append('svg')
						.attr('width', width)
						.attr('height', _this.parent.h - 40);
			var colors = ['#fdae6b', '#a1d99b', '#bcbddc'];
			var gGroup;
			var mainSvg = svg.append('g').attr('class','mainSVG')
						.attr('transform', 'translate(' + width / 2 + ',' + (height / 2+20 ) + ')');
			svg.append('text')
				.style('font-size', 15)
				.attr('transform', 'translate(' + (width - 75) + ',' + 12 + ')')
				.style('text-anchor', 'middle')
				.text(_this.parent.experimentType);
			svg.append('text')
				.style('font-size', 15)
				.attr('transform', 'translate(' + (0) + ',' + 12 + ')')
				.style('text-anchor', 'start')
				.style('fill', '#f0f')
				.text(_this.parent.preHierarchical);

			svg.append('text').attr('class','ortholog')
				.style('font-size', 12)
				.attr('transform', 'translate(' + 10 + ',' + 27 + ')')
				.style('text-anchor', 'start')
				.style('fill', '#666')
				.text(_this.parent.orthologLabel);

			svg.append('text').attr('class','expression')
				.style('font-size', 12)
				.attr('transform', 'translate(' + (0) + ',' + 43 + ')')
				.style('text-anchor', 'start')
				.style('fill', '#666')
				.text(_this.parent.expressionLabel);

			this.zoomListener = d3.behavior.zoom()
				.translate([0, 0])
				.scaleExtent([1, 10])
				.on('zoomstart', function() {
					this.zoomScale = this.zoomListener.scale();
					this.zoomTranslate = this.zoomListener.translate();
				}.bind(this))
				.on('zoom', function () {
					var cx, cy;
					this.zoomScale = d3.event.scale;
					this.zoomTranslate = d3.event.translate;
					cx = this.x + this.w * 0.5 + this.zoomTranslate[0] / this.zoomScale;
					cy = this.y + this.h * 0.5 + this.zoomTranslate[1] / this.zoomScale;
					gGroup.attr('transform', 'translate(' + d3.event.translate + ')scale(' + d3.event.scale + ')');
					this.parent.links.forEach(function(link) {
						if (link.source == this.parent) {
							link.sourceOffset.x = cx + link.radialX * this.zoomScale;
							link.sourceOffset.y = cy + link.radialY * this.zoomScale;}
						else if (link.target == this.parent) {
							link.sourceOffset.x = cx + link.radialX * this.zoomScale;
							link.sourceOffset.y = cy + link.radialY * this.zoomScale;}
						$P.state.overlayCanvas.needsRedraw = true;
					}.bind(this));
				}.bind(this));

			var partition = d3.layout.partition()
						.value(function (d) {
							return d.size;
						});
			var arcReal = d3.svg.arc()
						.startAngle(function (d) {
							return Math.max(0, Math.min(2 * Math.PI, x(d.x)));
						})
						.endAngle(function (d) {
							return Math.max(0, Math.min(2 * Math.PI, x(d.x + d.dx)));
						})
						.innerRadius(function (d) {
							return Math.max(0, y(d.y));
						})
						.outerRadius(function (d) {
							return Math.max(0, y(d.y + d.dy));
						});

			var arc = function(datum) {
				var angle = x(datum.x + datum.dx * 0.5) - Math.PI * 0.5;
				datum.outsideEdge =
					new $P.Vector2D(Math.cos(angle), Math.sin(angle))
					.times(y(datum.y + datum.dy * 0.8));
				return arcReal(datum);};

			var itemDrag = d3.behavior.drag()
						.on('dragstart', function(d) {
							_this.dragging = this;
							_this.dragOffset = {x: 0, y: 0};
							_this.dragLeft = d3.event.sourceEvent.which == 1;})
						.on('drag', function(d) {
							if (!_this.dragLeft) {return;}
							_this.dragOffset.x += d3.event.dx;
							_this.dragOffset.y += d3.event.dy;
							_this.dragAbsolute = {x: d3.event.x, y: d3.event.y};
							var dx = _this.dragOffset.x,
									dy = _this.dragOffset.y;
							d3.select(this).attr('transform', 'translate('+dx+','+dy+')');
						})
						.on('dragend', function(d) {
							var force, x, y, expression, color;

							if (!_this.dragLeft) {return;}
							if (!_this.dragAbsolute) {return;}

							x = _this.dragAbsolute.x + _this.parent.x + _this.parent.w * 0.5,
							y = _this.dragAbsolute.y + _this.parent.y + _this.parent.h * 0.5;

							force = $P.state.scene.sendEvent({name: 'reactionDrag', x: x, y: y});

							// No object, so make a new force diagram.
							if (!force) {
								force = new $P.Force({x: x, y: y, w: 600, h: 600});
								$P.state.scene.add(force);
								force.addPathway(d.dbId, d.name, bubble.strokeStyle);
								d.symbols.forEach(function(symbol) {
									if (!symbol) {return;}
									force.svg.entity_expand({name: symbol, pathwayId: d.dbId}, _this.getExpressionMap());});}

							// The object is a force, so add.
							else if (force instanceof $P.Force) {
								force.addPathway(d.dbId, d.name, bubble.strokeStyle);
								d.symbols.forEach(function(symbol) {
									force.svg.entity_expand({name: symbol, pathwayId: d.dbId}, _this.getExpressionMap());});}

							color = force.getPathwayColor(d.dbId);
							$P.state.scene.links.push(
								new $P.BubbleLink({
									fillStyle: color,
									source: new $P.D3TreeRing.BubbleLinkEnd({
										d3ring: treeRing,
										datum: d3.select(this).datum()}),
									target: new $P.BubbleLink.End({object: force})}));

							d3.select(this).attr('transform', null);
							_this.dragging = null;
							_this.dragOffset = null;
						});

			var tooltip = d3.select(this.parent.svg.element)
						.append('div')
						.attr('class', 'tooltip')
						.style('fill', '#333')
						.style('font-size', '12px')
						.style('background', '#eee')
						.style('box-shadow', '0 0 5px #999999')
						.style('position', 'absolute')
						.style('z-index', '10');

			function format_number(x) {
				return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
			}

			function format_name(d) {
				var name = d.name;
				return  '<b>' + name + '</b>';
			}

			var nodeData;
			//edge ----------------------------------------------------------------------------
			var bundle = d3.layout.bundle();
			var diagonal = d3.svg.diagonal()
						.projection(function (d) {
							return [d.x, d.y];
						});

			d3.json('./data/crossTalkings.json', function (error, crossTalkSymbols) {
				_this._crossTalkSymbols = crossTalkSymbols;

				d3.text('./data/ratelimitsymbol.txt', function (error, rateLimitSymbols) {
					//                rateLimitSymbols = rateLimitSymbols.replace(/\r\n/g, '\n');
					//                rateLimitSymbols = rateLimitSymbols.replace(/\r/g, '\n');
					//                var rateLimit_Symbols = rateLimitSymbols.split('\n');
					var rateLimit_Symbols = rateLimitSymbols.split('\r\n');
					_this._rateLimitSymbols.keys = d3.set(rateLimit_Symbols.map(function (d) {
						if (d !== '')
							return d;
					})).values().sort(function (a, b) {
						return ( a < b ? -1 : a > b ? 1 : 0);
					});
					_this._rateLimitSymbols.values = _this._rateLimitSymbols.keys.map(function (d) {
						return 0;
					});
					for (var i = 0; i < rateLimit_Symbols.length; ++i) {
						var index = _this._rateLimitSymbols.keys.indexOf(rateLimit_Symbols[i]);
						if (index !== -1) {
							_this._rateLimitSymbols.values[index]++;
						}
					}
					{   //main
						var minRatio;
						var maxRatio;
						//                        if (_this.selectedData == null) {  //12/10/2014
						d3.json(_this.file, function (error, root) {
							if (_this.customOrtholog && !_this.customExpression) {
								nodeData = partition.nodes(root);
								for (var i = 0; i < nodeData.length; ++i)  //every pathway
								{
									if (nodeData[i].symbols == undefined) {
										continue;
									}
									var count = 0;
									nodeData[i].gallusOrth = {};
									nodeData[i].gallusOrth.sharedSymbols = [];
									for (var k = 0; k < nodeData[i].symbols.length; ++k) {
										for (var j = 0; j < _this.customOrtholog.length; ++j) {
											if (nodeData[i].symbols[k] == null)
												continue;
											if (nodeData[i].symbols[k].toUpperCase() == _this.customOrtholog[j].symbol.toUpperCase()) {
												if (_this.customOrtholog[j].dbId !== '\N') {
													count++;
													nodeData[i].gallusOrth.sharedSymbols.push(_this.customOrtholog[j].symbol);
													break;
												}
											}
										}
									}

									if (count === nodeData[i].symbols.length) {
										nodeData[i].gallusOrth.type = 'Complete';
									}
									else if (count === 0) {
										nodeData[i].gallusOrth.type = 'Empty';
									}
									else {
										nodeData[i].gallusOrth.type = 'Part';
									}
								}
								_this.maxLevel = d3.max(nodeData, function (d) {

									return d.depth;
								});

								if (!_this.changeLevel) {
									var tmpString = '';
									for (var i = 1; i <= _this.maxLevel; ++i) {
										tmpString += '<option value=' + i + '>' + 'crossTalkLevel ' + i + '</option>';
									}
									$(_this.parent.menu.element).find('#crossTalkLevel').html(tmpString);
								}

								operation(nodeData);
							}   //Custom Ortholog
							else if (_this.customExpression && !_this.customOrtholog)    //Default Ortholog //custom expression
							{
								var minRatio = _this.parent.minRatio;
								var maxRatio = _this.parent.maxRatio;
								if (minRatio == '') {minRatio = '-1.5';}
								if (maxRatio == '') {maxRatio = '1.5';}
								minRatio = parseFloat(minRatio);
								maxRatio = parseFloat(maxRatio);
								nodeData = partition.nodes(root);
								for (var i = 0; i < nodeData.length; ++i)  //every pathway
								{
									if (nodeData[i].gallusOrth == undefined) {
										continue;
									}
									if (nodeData[i].gallusOrth.sharedSymbols == undefined) {
										continue;
									}
									nodeData[i].expression = {};
									nodeData[i].expression.ups = [];
									nodeData[i].expression.downs = [];
									nodeData[i].expression.unchanges = [];
									for (var k = 0; k < nodeData[i].gallusOrth.sharedSymbols.length; ++k) {

										for (var j = 0; j < _this.customExpression.length; ++j) {
											if (nodeData[i].gallusOrth.sharedSymbols[k] == null)
												continue;
											if (nodeData[i].gallusOrth.sharedSymbols[k].toUpperCase() == _this.customExpression[j].symbol.toUpperCase()) {
												if (parseFloat(_this.customExpression[j].ratio) >= maxRatio) {
													nodeData[i].expression.ups.push(_this.customExpression[j]);
													break;
												}
												else if (parseFloat(_this.customExpression[j].ratio) <= minRatio) {
													nodeData[i].expression.downs.push(_this.customExpression[j]);
													break;
												}
												else {
													nodeData[i].expression.unchanges.push(_this.customExpression[j]);
													break;
												}
											}
										}
									}
								}
								_this.maxLevel = d3.max(nodeData, function (d) {
									return d.depth;
								});
								if (!_this.changeLevel) {
									var tmpString = '';
									for (var i = 1; i <= _this.maxLevel; ++i) {
										tmpString += '<option value=' + i + '>' + 'crossTalkLevel ' + i + '</option>';
									}
									if (_this.parent.menu) {
										$(_this.parent.menu.element).find('#crossTalkLevel').html(tmpString);}
								}
								operation(nodeData);
							}
							else if (_this.customExpression && _this.customOrtholog) {
								var minRatio = _this.parent.minRatio;
								var maxRatio = _this.parent.maxRatio;
								if (minRatio == '') {minRatio = '-1.5';}
								if (maxRatio == '') {maxRatio = '1.5';}
								minRatio = parseFloat(minRatio);
								maxRatio = parseFloat(maxRatio);
								nodeData = partition.nodes(root);
								for (var i = 0; i < nodeData.length; ++i)  //every pathway
								{
									if (nodeData[i].symbols == undefined) {
										continue;
									}
									//---------------------
									var count = 0;
									nodeData[i].gallusOrth = {};
									nodeData[i].gallusOrth.sharedSymbols = [];

									//---------------------
									nodeData[i].expression = {};
									nodeData[i].expression.ups = [];
									nodeData[i].expression.downs = [];
									nodeData[i].expression.unchanges = [];

									for (var k = 0; k < nodeData[i].symbols.length; ++k) {
										for (var j = 0; j < _this.customOrtholog.length; ++j) {
											if (nodeData[i].symbols[k] == null)
												continue;
											if (nodeData[i].symbols[k].toUpperCase() == _this.customOrtholog[j].symbol.toUpperCase()) {
												if (_this.customOrtholog[j].dbId !== '\N') {
													count++;
													nodeData[i].gallusOrth.sharedSymbols.push(_this.customOrtholog[j].symbol);
													break;
												}
											}
										}
									}
									for (var k = 0; k < nodeData[i].gallusOrth.sharedSymbols.length; ++k) {
										for (var j = 0; j < _this.customExpression.length; ++j) {
											if (nodeData[i].gallusOrth.sharedSymbols[k] == null)
												continue;
											if (nodeData[i].gallusOrth.sharedSymbols[k].toUpperCase() == _this.customExpression[j].symbol.toUpperCase()) {
												if (parseFloat(_this.customExpression[j].ratio) >= maxRatio) {
													nodeData[i].expression.ups.push(_this.customExpression[j]);
													break;
												}
												else if (parseFloat(_this.customExpression[j].ratio) <= minRatio) {
													nodeData[i].expression.downs.push(_this.customExpression[j]);
													break;
												}
												else {
													nodeData[i].expression.unchanges.push(_this.customExpression[j]);
													break;
												}
											}
										}
									}
									if (count === nodeData[i].symbols.length) {
										nodeData[i].gallusOrth.type = 'Complete';
									}
									else if (count === 0) {
										nodeData[i].gallusOrth.type = 'Empty';
									}
									else {
										nodeData[i].gallusOrth.type = 'Part';
									}
								}
								_this.maxLevel = d3.max(nodeData, function (d) {

									return d.depth;
								});
								if (!_this.changeLevel) {
									var tmpString = '';
									for (var i = 1; i <= _this.maxLevel; ++i) {
										tmpString += '<option value=' + i + '>' + 'crossTalkLevel ' + i + '</option>';
									}
									$(_this.parent.menu.element).find('#crossTalkLevel').html(tmpString);
								}
								operation(nodeData);
							}
							else {
								nodeData = partition.nodes(root);
								_this.maxLevel = d3.max(nodeData, function (d) {
									return d.depth;
								});
								if (!_this.changeLevel && _this.parent.menu) {
									var tmpString = '';
									for (var i = 1; i <= _this.maxLevel; ++i) {
										tmpString += '<option value=' + i + '>' + 'crossTalkLevel ' + i + '</option>';
									}
									$(_this.parent.menu.element).find('#crossTalkLevel').html(tmpString);
									//                                        _this.parent.name = root.name + ' ' + _this.parent.name;
								}
								operation(nodeData);
							}
						});
						function operation(nodeData) {

							var crossTalkFileName = './data/crossTalkLevel/' + nodeData[0].name + '.json';
							_this.parent.crossTalkLevel = _this.showCrossTalkLevel;
							d3.json(crossTalkFileName, function (error, crossTalkData) {
								var classes = crossTalkData[_this.showCrossTalkLevel - 1];
								gGroup = mainSvg.append('g').attr('class', 'graphGroup');
								gGroup.call(_this.zoomListener) // delete this line to disable free zooming
									.call(_this.zoomListener.event);
								var pathG = gGroup.append('g').selectAll('.path');
								var link = gGroup.append('g').selectAll('.link');
								var node = gGroup.append('g').selectAll('.node');
								var downNode= gGroup.append('g').selectAll('.downNode');
								var highlightNode = gGroup.append('g').selectAll('.highlightNode');
								var textG = gGroup.append('g').selectAll('.text');
								var expressionColors = [
									'#08519c',
									'#3182bd',
									'#6baed6',
									'#bdd7e7',
									'#eff3ff',
									'#fdd0a2',//red
									'#fdae6b',
									'#fd8d3c',
									'#e6550d',
									'#a63603'
								];
								processTextLinks(nodeData);
								if(_this.highlightPathways.length)
								{
									processHighlightNode(nodeData);
								}
								if (_this.parent.menuHidden) {
									var max;
									for (var i = 0; i < nodeData.length; ++i) {
										if (nodeData[i].name !== 'homo sapiens' && nodeData[i].expression !== undefined && nodeData[i].gallusOrth !== undefined) {
											nodeData[i].unique = {};
											nodeData[i].unique.ups = [];
											nodeData[i].unique.downs = [];
											nodeData[i].unique.sharedSymbols = [];
											for (var j = 0; j < nodeData[i].expression.ups.length; ++j) {
												if (nodeData[i].unique.ups.indexOf(nodeData[i].expression.ups[j]) == -1) {
													nodeData[i].unique.ups.push(nodeData[i].expression.ups[j]);
												}
											}
											for (var j = 0; j < nodeData[i].expression.downs.length; ++j) {
												if (nodeData[i].unique.downs.indexOf(nodeData[i].expression.downs[j]) == -1) {
													nodeData[i].unique.downs.push(nodeData[i].expression.downs[j]);
												}
											}
											for (var j = 0; j < nodeData[i].gallusOrth.sharedSymbols.length; ++j) {
												if (nodeData[i].unique.sharedSymbols.indexOf(nodeData[i].gallusOrth.sharedSymbols[j]) == -1) {
													nodeData[i].unique.sharedSymbols.push(nodeData[i].gallusOrth.sharedSymbols[j]);
												}
											}
										}

									}

									max = d3.max(nodeData, function (d) {
										if (d.name == 'homo sapiens' || d.expression == undefined || d.gallusOrth == undefined)
											return 0;
										//                            return (d.expression.downs.length + d.expression.ups.length) / d.gallusOrth.sharedSymbols.length;
										return (d.unique.downs.length + d.unique.ups.length) / d.unique.sharedSymbols.length;
									});
									//                                    }
									//                                    else {
									//                                        max = _this.expressionScaleMax;
									//                                    }

									var divisions = 10;

									var scaleMargin = {top: 5, right: 5, bottom: 5, left: 5},
											scaleWidth = 30 - scaleMargin.left - scaleMargin.right,
											scaleHeight = 170 - scaleMargin.top - scaleMargin.bottom;

									var newData = [];
									var sectionHeight = Math.floor(scaleHeight / divisions);
									for (var i = 0, j = 0; i < scaleHeight && j <= max; i += sectionHeight, j += max / 9) {
										var obj = {};
										obj.data = 9-i;
										obj.text = parseFloat(j).toFixed(3);
										newData.push(obj);
									}

									var BarWidth = scaleWidth + scaleMargin.left + scaleMargin.right;
									var BarHeight = scaleHeight + scaleMargin.top + scaleMargin.bottom;

									var colorScaleBar = svg.append('g')
												.attr('class', 'colorScaleBar')
												.attr('transform', 'translate(' + (width - 3 * scaleWidth) + ',' + ( height  ) + ')')
												.attr('width', BarWidth)
												.attr('height', BarHeight);

									colorScaleBar.selectAll('rect')
										.data(newData)
										.enter()
										.append('rect')
										.attr('x', 0)
										.attr('y', function (d) {
											return d.data;
										})
										.attr('height', sectionHeight)
										.attr('width', scaleWidth)
										.attr('fill', function (d, i) {
											return expressionColors[i]
										});

									colorScaleBar.selectAll('text')
										.data(newData)
										.enter().append('text')
										.style('font-size', 10)
										.attr('transform', 'translate(' + (scaleWidth / 2 + 10) + ',' + (sectionHeight) + ')')
										.attr('y', function (d, i) {
											return d.data - 5;
										})
										.attr('dy', '.1em')
										.style('text-anchor', 'start')
										.text(function (d, i) {
											return d.text;
										});
								}


								function getExpressionColor(ratio) {
									if (max == 0)
										return expressionColors[0];
									return expressionColors[Math.floor(9 * ratio / max)];
								}

								pathG = pathG.data(nodeData)
									.enter().append('path')
									.attr('id', function (d, i) {
										return 'group' + i;
									})
									.attr('d', arc)
									.style('fill', function (d, i) {
										if (i == 0)
											return '#fff';
										if (!_this.customExpression) {
											if (d.children !== undefined)
												var gallusOrth = (d.children ? d : d.parent).gallusOrth;
											else
												var gallusOrth = d.gallusOrth;
											if (gallusOrth !== undefined) {
												if (gallusOrth.type === 'Part') {
													return colors[0];
												}
												else if (gallusOrth.type === 'Complete') {
													return colors[1];
												}
												else if (gallusOrth.type === 'Empty') {
													return colors[2];
												}
											}
											else {
												return '#fff';
											}
										}
										else if (_this.customExpression) {
											if (d.name == 'homo sapiens' || d.expression == undefined || d.gallusOrth == undefined)
												return '#fff';
											//                            else if (d.gallusOrth.sharedSymbols.length == 0) {
											else if (d.unique.sharedSymbols.length == 0) {
												return getExpressionColor(0);
											}
											else {
												//                                return colorRange((d.expression.downs.length + d.expression.ups.length) / d.gallusOrth.sharedSymbols.length);
												return getExpressionColor((d.unique.downs.length + d.unique.ups.length) / d.unique.sharedSymbols.length);
											}
										}
									})
									.style('cursor', 'pointer')
									.on('contextmenu', rightClick)
									.on('click', click)
									.on('mousedown', function() {d3.event.stopPropagation();})
									.on('mouseover', function (d, i) {
										if (d.name == 'homo sapiens')
											return;
										tooltip.html(function () {
											return format_name(d);
										});
										return tooltip.transition()
											.duration(50)
											.style('opacity', 0.9);
									})
									.on('mousemove', function (d, i) {
										if (d.name == 'homo sapiens')
											return;
										return tooltip
											.style('top', (d3.event.pageY - 10 - _this.parent.y - 70 ) + 'px')
											.style('left', (d3.event.pageX + 10 - _this.parent.x) + 'px');
									})
									.on('mouseout', function () {
										return tooltip.style('opacity', 0);
									})
									.call(itemDrag);
								svg.on('mouseout', function () {
									return tooltip.html('');
								});

								textG = textG.data(nodeData.filter(
									function (d, i) {
										if (i == 0)          //center of the circle
											return true;
										var thea = Math.max(0, Math.min(2 * Math.PI, x(d.x + d.dx))) - Math.max(0, Math.min(2 * Math.PI, x(d.x)));
										var r = Math.max(0, y(d.y));
										return thea * r >= 10;
									}))
									.enter().append('text')
									.attr('class', 'bar-text') // add class
									.attr('text-anchor', function (d) {
										return 'middle';
										//                        return x(d.x + d.dx / 2) > Math.PI ? 'end' : 'start';
									})
									.attr('transform', function (d, i) {
										if (i == 0)
											return 'rotate(0)';
										var angle = x(d.x + d.dx / 2) * 180 / Math.PI - 90;

										return 'rotate(' + angle + ')translate(' + (y(d.y) + 10) + ')rotate(' + (angle > 90 ? -180 : 0) + ')'
									})
									.attr('dy', '.35em') // vertical-align
									.style('font-size', 10)
									.text(function (d, i) {
										//                        if(d.name == 'homo sapiens')
										//                            return '';
										if (i == 0)
											return '';
										var str = d.name;
										str = str.match(/\b\w/g).join('');
										str = str.substr(0, 4);
										return str;
									});
								var symbol_max;

								function computeTextRotation(d, i) {
									if (i == 0)
										return 0;
									var angle = x(d.x + d.dx / 2) - Math.PI / 2;
									return angle / Math.PI * 180;
								}

								if (classes !== undefined && classes.length) {
									var objects = processLinks(nodeData, classes);
									var links = objects.imports;
									if (!_this.customExpression) {
										symbol_max = d3.max(objects.nodes, function (d) {
											var temp = 0;
											if (d.gallusOrth.sharedSymbols !== undefined)
												temp = d.gallusOrth.sharedSymbols.length;
											return temp;
										});
									}
									else if (_this.customExpression) {
										var DownMax = d3.max(objects.nodes, function (d) {
											if (d.expression !== undefined) {
												return d.expression.downs.length;
											}
											else {
												return 0;
											}

										});
										var upMax = d3.max(objects.nodes, function (d) {
											if (d.expression !== undefined) {
												return d.expression.ups.length;
											}
											else {
												return 0;
											}

										});
									}
									var _nodes = objects.nodes;
									//                    maxLevel = 6 - _nodes[0].depth;
									link = link
										.data(bundle(links))
										.enter().append('path')
										.each(function (d) {
											d.source = d[0];
											d.target = d[d.length - 1];
										})
										.attr('class', 'link')
										.attr('d', diagonal);
									if (!_this.customExpression) {
										node = node
											.data(_nodes)
											.attr('id', function (d, i) {
												return 'node' + d.dbId;
											})
											.enter().append('rect')
											.attr('class', 'node')
											.attr('x', function (d) {
												return y(d.dy);
											})
											.attr('height', function (d) {
												var thea = Math.max(0, Math.min(2 * Math.PI, x(d.dx + d.d_dx))) - Math.max(0, Math.min(2 * Math.PI, x(d.dx)));
												var r = Math.max(0, y(d.dy));
												return Math.min(r * thea, Math.floor(_this.maxLevel));
											})
											.attr('y', function (d) {
												var thea = Math.max(0, Math.min(2 * Math.PI, x(d.dx + d.d_dx))) - Math.max(0, Math.min(2 * Math.PI, x(d.dx)));
												var r = Math.max(0, y(d.dy));
												return -(Math.min(r * thea, Math.floor(_this.maxLevel))) / 2;
											})
											.attr('width', function (d) {
												var temp = 0;
												if (d.gallusOrth !== undefined)
													temp = d.gallusOrth.sharedSymbols.length;
												if (symbol_max == 0)
													return 0;
												return 2/3*Math.floor(temp / symbol_max * ( Math.max(0, y(d.dy + d.d_dy)) - Math.max(0, y(d.dy)) ));
											})
											.attr('transform', function (d, i) {
												return 'rotate(' + computeRotation(d, i) + ')';
											})
											.style('fill', '#f00')
											.on('contextmenu', barClick)
											.on('mouseover', mouseovered)
											.on('mouseout', mouseouted);
									}
									else {
										node = node
											.data(_nodes)
											.attr('id', function (d, i) {
												return 'nodeUp' + d.dbId;
											})
											.enter().append('rect')
											.attr('class', 'node').attr('class','upExpressed')
											.attr('x', function (d) {

												return y(d.dy);
											})
											.attr('height', function (d) {
												var thea = Math.max(0, Math.min(2 * Math.PI, x(d.dx + d.d_dx))) - Math.max(0, Math.min(2 * Math.PI, x(d.dx)));
												var r = Math.max(0, y(d.dy));
												return Math.min(r * thea, Math.floor(_this.maxLevel));
											})
											.attr('y', function (d) {
												var thea = Math.max(0, Math.min(2 * Math.PI, x(d.dx + d.d_dx))) - Math.max(0, Math.min(2 * Math.PI, x(d.dx)));
												var r = Math.max(0, y(d.dy));
												return -(Math.min(r * thea, Math.floor(_this.maxLevel))) / 2;
											})
											.style('fill', '#f00')
											.attr('width', function (d) {
												if(d.upX==undefined)
												{
													d.upX = 0;
												}
												if (d.expression == undefined || d.gallusOrth == undefined || upMax == 0)
												{
													d.upX= 0;
													return d.upX;
												}
												d.upX= 1/2*Math.floor( (d.expression.ups.length) / upMax * ( Math.max(0, y(d.dy + d.d_dy)) - Math.max(0, y(d.dy)) ));
												return d.upX;
											})
											.attr('transform', function (d, i) {
												return 'rotate(' + computeRotation(d, i) + ')';
											})
											.on('contextmenu', expressionBarClick)
											.on('mouseover', mouseovered)
											.on('mouseout', mouseouted);
										downNode = downNode
											.data(_nodes)
											.attr('id', function (d, i) {
												return 'nodeDown' + d.dbId;
											})
											.enter()
											.append('rect')
											.attr('class', 'node').attr('class','downExpressed')
											.attr('x', function (d) {
												if(d.upX==undefined)
													return y(d.dy);
												else
												{
													return y(d.dy)+ d.upX;
												}
											})
											.attr('height', function (d) {
												var thea = Math.max(0, Math.min(2 * Math.PI, x(d.dx + d.d_dx))) - Math.max(0, Math.min(2 * Math.PI, x(d.dx)));
												var r = Math.max(0, y(d.dy));
												return Math.min(r * thea, Math.floor(_this.maxLevel));
											})
											.attr('y', function (d) {
												var thea = Math.max(0, Math.min(2 * Math.PI, x(d.dx + d.d_dx))) - Math.max(0, Math.min(2 * Math.PI, x(d.dx)));
												var r = Math.max(0, y(d.dy));
												return -(Math.min(r * thea, Math.floor(_this.maxLevel))) / 2;
											})
											.attr('width', function (d) {
												if (d.expression == undefined || d.gallusOrth == undefined || DownMax == 0)
													return 0;
												return 1/2*Math.floor((d.expression.downs.length) / DownMax * ( Math.max(0, y(d.dy + d.d_dy)) - Math.max(0, y(d.dy)) ));
											})
											.style('fill', '#0f0')
											.attr('transform', function (d, i) {
												return 'rotate(' + computeRotation(d, i) + ')';
											})
											.on('contextmenu', expressionBarClick)
											.on('mouseover', mouseovered)
											.on('mouseout', mouseouted);

									}
								}
								else {
									if (!_this.customExpression) {
										symbol_max = d3.max(nodeData, function (d) {
											var temp = 0;
											if (d.gallusOrth.sharedSymbols !== undefined)
												temp = d.gallusOrth.sharedSymbols.length;
											return temp;
										});
									}
									else if (_this.customExpression) {
										var upMax = d3.max(nodeData, function (d) {
											if (d.expression !== undefined) {
												return d.expression.ups.length;
											}
											else {
												return 0;
											}
										});
										var DownMax = d3.max(nodeData, function (d) {
											if (d.expression !== undefined) {
												return d.expression.downs.length;
											}
											else {
												return 0;
											}
										});
									}
									if (!_this.customExpression) {
										node = node
											.data(nodeData.filter(function (d) {
												return d.depth == 1;
											}))
											.enter().append('rect')
											.attr('class', 'node')
											.attr('x', function (d) {
												return y(d.y);
											})
											.attr('height', function (d) {
												var thea = Math.max(0, Math.min(2 * Math.PI, x(d.x + d.dx))) - Math.max(0, Math.min(2 * Math.PI, x(d.x)));
												var r = Math.max(0, y(d.y));
												return Math.min(r * thea, Math.floor(_this.maxLevel));
											})
											.attr('y', function (d) {
												var thea = Math.max(0, Math.min(2 * Math.PI, x(d.x + d.dx))) - Math.max(0, Math.min(2 * Math.PI, x(d.x)));
												var r = Math.max(0, y(d.y));
												return -(Math.min(r * thea, Math.floor(_this.maxLevel))) / 2;
											})
											.attr('width', function (d) {
												var temp = 0;
												if (d.gallusOrth !== undefined)
													temp = d.gallusOrth.sharedSymbols.length;
												if (symbol_max == 0)
													return 0;
												return 2/3*Math.floor(temp / symbol_max * ( Math.max(0, y(d.y + d.dy)) - Math.max(0, y(d.y)) ));
											})
											.attr('transform', function (d, i) {
												return 'rotate(' + computeBarRotation(d, i) + ')';
											})
											.style('fill', '#f00')
											.on('contextmenu', barClick);
									}
									else {
										node = node
											.data(nodeData.filter(function (d) {
												return d.depth == 1;
											}))
											.enter().append('rect')
											.attr('class', 'node').attr('class','downExpressed')
											.attr('x', function (d) {
												return y(d.y);
											})
											.attr('height', function (d) {
												var thea = Math.max(0, Math.min(2 * Math.PI, x(d.x + d.dx))) - Math.max(0, Math.min(2 * Math.PI, x(d.x)));
												var r = Math.max(0, y(d.y));
												return Math.min(r * thea, Math.floor(_this.maxLevel));
											})
											.attr('y', function (d) {
												var thea = Math.max(0, Math.min(2 * Math.PI, x(d.x + d.dx))) - Math.max(0, Math.min(2 * Math.PI, x(d.x)));
												var r = Math.max(0, y(d.y));
												return -(Math.min(r * thea, Math.floor(_this.maxLevel))) / 2;
											})
											.attr('width', function (d) {
												if(d.upX==undefined)
													d.upX = 0;
												if (d.expression == undefined || d.gallusOrth == undefined || upMax == 0|| d.depth==0)
													d.upX= 0;
												else
													d.upX=1/2*Math.floor((d.expression.ups.length) / upMax * ( Math.max(0, y(d.y + d.dy)) - Math.max(0, y(d.y)) ));
												return d.upX;
											})
											.attr('transform', function (d, i) {
												return 'rotate(' + computeBarRotation(d, i) + ')';
											})
											.style('fill', '#f00')
											.on('contextmenu', expressionBarClick);

										downNode = downNode
											.data(nodeData.filter(function (d) {
												return d.depth == 1;
											}))
											.attr('id', function (d, i) {
												return 'nodeDown' + d.dbId;
											})
											.enter()
											.append('rect')
											.attr('class', 'node').attr('class','downExpressed')
											.attr('x', function (d) {
												if(d.upX==undefined)
													return y(d.y);
												else
												{
													return y(d.y)+ d.upX;
												}
											})
											.attr('height', function (d) {
												var thea = Math.max(0, Math.min(2 * Math.PI, x(d.x + d.dx))) - Math.max(0, Math.min(2 * Math.PI, x(d.x)));
												var r = Math.max(0, y(d.y));
												return Math.min(r * thea, Math.floor(_this.maxLevel));
											})
											.attr('y', function (d) {
												var thea = Math.max(0, Math.min(2 * Math.PI, x(d.x + d.dx))) - Math.max(0, Math.min(2 * Math.PI, x(d.x)));
												var r = Math.max(0, y(d.y));
												return -(Math.min(r * thea, Math.floor(_this.maxLevel))) / 2;
											})
											.attr('width', function (d) {
												if (d.expression == undefined || d.gallusOrth == undefined || DownMax == 0|| d.depth==0)
													return 0;
												return 1/2*Math.floor((d.expression.downs.length) / DownMax * ( Math.max(0, y(d.y + d.dy)) - Math.max(0, y(d.y)) ));
											})
											.style('fill', '#0f0')
											.attr('transform', function (d, i) {
												return 'rotate(' + computeBarRotation(d, i) + ')';
											})
											.on('contextmenu', expressionBarClick)
											.on('mouseover', mouseovered)
											.on('mouseout', mouseouted);
									}
									function computeBarRotation(d, i) {
										var angle = x(d.x + d.dx / 2) - Math.PI / 2;
										return angle / Math.PI * 180;
									}

								}

								function barClick() {
									var symbols = d3.select(this).datum().gallusOrth.sharedSymbols;
									var _symbols = [];
									for (var i = 0; i < symbols.length; ++i) {
										if (symbols[i] == null)
											continue;
										var symbolObj = {};
										for (var j = 0; j < _symbols.length; ++j) {
											if (_symbols[j].symbol == symbols[i]) {
												break;
											}
										}
										if (j >= _symbols.length) {
											symbolObj.symbol = symbols[i];
											symbolObj.count = 1;
											symbolObj.crossTalk = 0;
											symbolObj.rateLimit = 0;
											_symbols.push(symbolObj);
										}
										else {
											_symbols[j].count++;
										}
									}
									for(var i=0; i<_symbols.length; ++i)
									{
										var index1 = _this._crossTalkSymbols.symbols.indexOf(_symbols[i].symbol);
										if(index1!==-1)
										{
											_symbols[i].crossTalk = _this._crossTalkSymbols.pathwayNames[index1].length;
										}
										else
										{
											_symbols[i].crossTalk = 0;
										}
										var index2 = _this._rateLimitSymbols.keys.indexOf(_symbols[i].symbol);
										if(index2!==-1)
										{
											_symbols[i].rateLimit = _this._rateLimitSymbols.values[index2];
										}
										else
										{
											_symbols[i].rateLimit = 0;
										}
									}
									var thisName = _this.parent.id + '_'+ d3.select(this).datum().name;
									var bubble = new PATHBUBBLES.Table(_this.parent.x + _this.parent.w - 40,
																										 _this.parent.y, 374, 400, d3.select(this).datum().dbId, _symbols,null, thisName);

									//                                    bubble.name = '(Shared protein) ' + d3.select(this).datum().name;
									bubble.experimentType = _this.parent.experimentType;
									bubble.crosstalking = _this._crossTalkSymbols;
									bubble.addHtml();
									bubble.table.keepQuery = true;
									bubble.menuOperation();
									$P.state.scene.add(bubble);
									if (!_this.parent.GROUP) {
										var group = new PATHBUBBLES.Groups();
										group.add(_this.parent);
										group.add(bubble);
										$P.state.scene.add(group);
									}
									else {
										if (_this.parent.parent instanceof  PATHBUBBLES.Groups) {
											_this.parent.parent.add(_this.parent);
											_this.parent.parent.add(bubble);
											$P.state.scene.add(_this.parent.parent);
										}
									}
									var id = _this.parent.id + '_' + bubble.id;
									var svgPos = $(_this.parent.svg.element).position();
									var transformString = d3.transform($(_this.parent.svg.element).find('.graphGroup').attr('transform'));
									var transformCenter = d3.transform($(_this.parent.svg.element).find('.mainSVG').attr('transform'));
									//relate to the center
									var relateData = d3.select(this).datum();

									var relatedX = relateData.x;
									var relatedY = relateData.y;
									d3.event.preventDefault();
								}

								function expressionBarClick() {
									if (d3.select(this).datum().expression == undefined)
										return;
									var ups = d3.select(this).datum().expression.ups;
									var downs = d3.select(this).datum().expression.downs;
									var _symbols = [];
									for (var i = 0; i < ups.length; ++i) {
										var symbolObj = {};
										for (var j = 0; j < _symbols.length; ++j) {
											if (_symbols[j].symbol.toUpperCase() == ups[i].symbol && _symbols[j].regulation == 'Up') {
												_symbols[j].count++;
												break;
											}
										}
										if (j >= _symbols.length) {

											symbolObj.gene_id = ups[i].gene_id;
											symbolObj.symbol = ups[i].symbol.toUpperCase();
											symbolObj.count = 1;
											symbolObj.ratio = parseFloat(ups[i].ratio).toFixed(5);
											symbolObj.regulation = 'Up';
											symbolObj.crossTalk = 0;
											symbolObj.rateLimit = 0;
											_symbols.push(symbolObj);
										}
									}

									var upLength = _symbols.length;
									for (var i = 0; i < downs.length; ++i) {
										var symbolObj = {};
										for (var j = upLength; j < _symbols.length; ++j) {
											if (_symbols[j].symbol.toUpperCase() == downs[i].symbol.toUpperCase() && _symbols[j].regulation == 'Down') {
												_symbols[j].count++;
												break;
											}
										}
										if (j >= _symbols.length) {
											symbolObj.gene_id = downs[i].gene_id;
											symbolObj.symbol = downs[i].symbol.toUpperCase();
											symbolObj.count = 1;
											symbolObj.ratio = parseFloat(downs[i].ratio).toFixed(5);
											symbolObj.regulation = 'Down';
											symbolObj.crossTalk = 0;
											symbolObj.rateLimit = 0;
											_symbols.push(symbolObj);
										}
									}
									for(var i=0; i<_symbols.length; ++i)
									{
										var index1 = _this._crossTalkSymbols.symbols.indexOf(_symbols[i].symbol);
										if(index1!==-1)
										{
											_symbols[i].crossTalk = _this._crossTalkSymbols.pathwayNames[index1].length;
										}
										else
										{
											_symbols[i].crossTalk = 0;
										}
										var index2 = _this._rateLimitSymbols.keys.indexOf(_symbols[i].symbol);
										if(index2!==-1)
										{
											_symbols[i].rateLimit = _this._rateLimitSymbols.values[index2];
										}
										else
										{
											_symbols[i].rateLimit = 0;
										}
									}
									var thisName = _this.parent.id + '_'+ d3.select(this).datum().name;
									var bubble = new PATHBUBBLES.Table(_this.parent.x + _this.parent.w - 40,
																										 _this.parent.y, 500, 500, d3.select(this).datum().dbId, _symbols,null,thisName);
									//                                    bubble.name = '(Expression) ' + d3.select(this).datum().name;
									bubble.crosstalking = _this._crossTalkSymbols;
									bubble.addHtml();
									bubble.experimentType = _this.parent.experimentType;
									bubble.table.keepQuery = true;
									bubble.menuOperation();
									$P.state.scene.add(bubble);
									if (!_this.parent.GROUP) {
										var group = new PATHBUBBLES.Groups();
										group.add(_this.parent);
										group.add(bubble);
										scene.addObject(group);
									}
									else {
										if (_this.parent.parent instanceof  PATHBUBBLES.Groups) {
											_this.parent.parent.add(_this.parent);
											_this.parent.parent.add(bubble);
											scene.addObject(_this.parent.parent);
										}
									}
									var id = _this.parent.id + '_' + bubble.id;
									var svgPos = $(_this.parent.svg.element).position();
									var transformString = d3.transform($(_this.parent.svg.element).find('.graphGroup').attr('transform'));
									var transformCenter = d3.transform($(_this.parent.svg.element).find('.mainSVG').attr('transform'));
									var relateData = d3.select(this).datum();

									var relatedX = relateData.x;
									var relatedY = relateData.y;
									bubble.addBubbleLink(_this.parent.id, bubble.id,
																			 (relatedX-transformString.translate[0])/transformString.scale[0],
																			 (relatedY-transformString.translate[1])/transformString.scale[1]);
									d3.event.preventDefault();
								}

								function computeRotation(d, i) {
									var angle = x(d.dx + d.d_dx / 2) - Math.PI / 2;
									return angle / Math.PI * 180;
								}
								function processHighlightNode(nodeData)
								{
									var highlights = [];
									nodeData.forEach(function(d){
										if(d.name!==undefined)
										{
											var index = _this.highlightPathways.indexOf(d.name);
											if(index !== -1)
											{
												var index1 = highlights.indexOf(d);
												if(index1 ==-1)
												{
													highlights.push(d);
												}
											}
										}
									});


									var nodeCircle = highlightNode.data(highlights).enter().append('g')
												.attr('class', 'highlightNode');
									nodeCircle =nodeCircle.append('circle')
										.attr('cx', function (d) {
											if(d.depth == 0)
												return 0;
											return Math.sin(
												Math.PI - (Math.max(0, Math.min(2 * Math.PI, x(d.x)))
																	 + Math.max(0, Math.min(2 * Math.PI, x(d.x + d.dx)))) / 2
											)
												* Math.max(0, y(d.y+ d.dy/2));
										})
										.attr('cy', function (d) {
											if(d.depth == 0)
												return 0;
											return Math.cos(
												Math.PI - (Math.max(0, Math.min(2 * Math.PI, x(d.x)))
																	 + Math.max(0, Math.min(2 * Math.PI, x(d.x + d.dx)))) / 2
											)
												* Math.max(0, y(d.y+ d.dy/2));
										})
										.attr('r',function(d){
											if(d.depth == 0)
												return 0;
											return 5;
										})
										.style('fill','yellow')
										.on('mouseover', function (d, i) {
											if (d.name == 'homo sapiens')
												return;
											tooltip.html(function () {
												return format_name(d);
											});
											return tooltip.transition()
												.duration(50)
												.style('opacity', 0.8);
										})
										.on('mousemove', function (d, i) {
											if (d.name == 'homo sapiens')
												return;
											return tooltip
												.style('top', (d3.event.pageY - 10 - _this.parent.y - 70 ) + 'px')
												.style('left', (d3.event.pageX + 10 - _this.parent.x) + 'px');
										})
										.on('mouseout', function () {
											return tooltip.style('opacity', 0);
										})
										.style('opacity', 0.8);
								}
								function processTextLinks(nodes) {
									var importLinks = [];
									var data = [];
									for (var i = 0; i < nodes.length; ++i) {
										if (nodes[i].depth == 1) {
											data.push(nodes[i]);
										}
									}
									var rect_height = 7;
									var rect_width = 20;
									var inner_y = d3.scale.linear()
												.domain([0, data.length])
												.range([-(data.length * rect_height) / 2, (data.length * rect_height) / 2]);
									var inners = [];
									for (var i = 0; i < data.length; ++i) {
										var object = {};
										object.id = i;
										object.name = data[i].name;
										object.x = -(rect_width / 2);
										object.y = inner_y(i);
										object.linkTo = data[i];
										inners.push(object);
									}

									for (var i = 0; i < inners.length; ++i) {
										var importObj = {};
										importObj.id = inners[i].id;
										importObj.target = inners[i];
										importObj.source = inners[i].linkTo;
										importLinks.push(importObj);
									}

									var inode = gGroup.append('g').selectAll('.inner_node');
									var titleLink = gGroup.append('g').attr('class', 'links').selectAll('.titleLink');
									var inodeRect = inode.data(inners).enter().append('g')
												.attr('class', 'inner_node');
									var inodeText = inode.data(inners).enter().append('g')
												.attr('class', 'inner_node');

									inodeText = inodeText.append('text')
										.attr('id', function (d) {
											return d.id + '-txt';
										})
										.attr('text-anchor', 'middle')
										.attr('transform', function (d) {
											return 'translate(' + ( rect_width / 2 + d.x ) + ', ' + (rect_height * .75 + d.y) + ')';
										})
										.style('font-size', rect_height)
										.text(function (d) {
											return d.name;
										})
										.each(function (d) {
											d.bx = this.getBBox().x;
											d.by = this.getBBox().y;
											d.bwidth = this.getBBox().width;
											d.bheight = this.getBBox().height;
										})
										.on('mouseover', mouserOverText)
										.on('mouseout', mouseOutText);

									inodeRect = inodeRect.append('rect')
										.attr('x', function (d) {
											return d.bx;
										})
										.attr('y', function (d) {
											return d.by;
										})
										.attr('width', function (d) {
											return d.bwidth;
										})
										.attr('height', function (d) {
											return d.bheight;
										})
										.attr('text-anchor', 'middle')
										.attr('transform', function (d) {
											return 'translate(' + ( rect_width / 2 + d.x ) + ', ' + (rect_height * .75 + d.y) + ')';
										})
										.attr('id', function (d) {
											return d.id + '-txt';
										})
										.attr('fill', function (d) {
											return '#e5f5f9';
										})
										.on('mouseover', mouserOverText)
										.on('mouseout', mouseOutText);
									var diagonal = d3.svg.diagonal()
												.source(function (d) {
													var innerRadius = Math.max(0, y(d.source.y));
													var arcCenter = x(d.source.x + d.source.dx / 2.0);

													return {'x': innerRadius * Math.cos(Math.PI - arcCenter),      //radial space
																	'y': innerRadius * Math.sin(Math.PI - arcCenter)};
												})
												.target(function (d) {                                           //normal space
													return {'x': d.target.y + rect_height / 2,
																	//                                'y': d.source.x ? d.target.x : d.target.x + rect_width};
																	'y': d.source.x + d.source.dx / 2.0 < Math.PI ? -d.target.bwidth / 2 : -d.target.bwidth / 2};
												})
												.projection(function (d) {
													return [d.y, d.x];
												});

									// links
									titleLink = titleLink
										.data(importLinks)
										.enter().append('path')
										.attr('class', 'titleLink')
										.attr('id', function (d) {
											return  'titleLink' + d.id;
										})
										.attr('d', diagonal)
										.attr('stroke', function (d) {
											return '#00f';
										})
										.attr('stroke-width', '1px');

									function mouserOverText(d) {
										d3.select(_this.parent.svg.element).select('#' + 'titleLink' + d.id).attr('stroke-width', '5px');
									}

									function mouseOutText(d) {
										d3.select(_this.parent.svg.element).select('#' + 'titleLink' + d.id).attr('stroke-width', '1px');
									}
								}

								function mouseovered(d) {
									node
										.each(function (n) {
											n.target = n.source = false;
										});

									link
										.classed('link--target', function (l) {
											if (l.target === d) return l.source.source = true;
										})
										.classed('link--source', function (l) {
											if (l.source === d) return l.target.target = true;
										})
										.filter(function (l) {
											return l.target === d || l.source === d;
										})
										.each(function () {
											this.parentNode.appendChild(this);
										});

									node
										.classed('node--target', function (n) {
											return n.target;
										})
										.classed('node--source', function (n) {
											return n.source;
										});
								}

								function mouseouted(d) {
									link
										.classed('link--target', false)
										.classed('link--source', false);

									node
										.classed('node--target', false)
										.classed('node--source', false);
								}

								function processLinks(nodes, classes) {
									var imports = [];
									var _nodes = [];
									for (var i = 0; i < nodes.length; ++i) {
										if (nodes[i].depth == _this.showCrossTalkLevel) {
											var dx = nodes[i].x;
											var dy = nodes[i].y;
											var d_dx = nodes[i].dx;
											var d_dy = nodes[i].dy;
											var temp = {};
											temp.x = Math.sin(
												Math.PI - (Math.max(0, Math.min(2 * Math.PI, x(dx)))
																	 + Math.max(0, Math.min(2 * Math.PI, x(dx + d_dx)))) / 2
											)
												* Math.max(0, y(dy));
											temp.y = Math.cos(
												Math.PI - (Math.max(0, Math.min(2 * Math.PI, x(dx)))
																	 + Math.max(0, Math.min(2 * Math.PI, x(dx + d_dx)))) / 2
											)
												* Math.max(0, y(dy));
											temp.name = nodes[i].name;
											temp.parent = nodes[i].parent;
											temp.depth = nodes[i].depth;
											temp.dbId = nodes[i].dbId;
											temp.children = nodes[i].children;

											temp.dx = nodes[i].x;
											temp.dy = nodes[i].y;
											temp.d_dx = nodes[i].dx;
											temp.d_dy = nodes[i].dy;
											temp.symbols = nodes[i].symbols;
											temp.gallusOrth = nodes[i].gallusOrth;
											if (_this.customExpression) {
												temp.expression = nodes[i].expression;
											}

											_nodes.push(temp);
										}
									}
									for (var i = 0; i < classes.length; ++i) {
										var source;
										var targets = [];
										if (classes[i].imports.length != 0) {
											for (var ii = 0; ii < _nodes.length; ++ii) {
												if (classes[i].name == _nodes[ii].name) {
													source = _nodes[ii];
												}
												for (var ij = 0; ij < classes[i].imports.length; ++ij) {
													if (classes[i].imports[ij] == _nodes[ii].name) {
														targets.push(_nodes[ii]);
													}
												}
											}
										}
										for (var ijk = 0; ijk < targets.length; ++ijk) {
											var importObj = {};
											importObj.source = source;
											importObj.target = targets[ijk];
											imports.push(importObj);
										}
									}
									return {imports: imports, nodes: _nodes};
								}

								function rightClick(d, i) {
									var datum, table;
									if (d3.event.defaultPrevented) {return;}

									datum = d3.select(this).datum(),
									table = new $P.Table({
										dbId: datum.dbId,
										name: datum.name,
										experimentType: bubble.experimentType,
										w: 400, h: 400});

									table.keepQuery = false;
									bubble.parent.add(table);
									$P.state.scene.links.push(
										new $P.BubbleLink({
											source: new $P.D3TreeRing.BubbleLinkEnd({
												d3ring: treeRing,
												datum: d3.select(this).datum()}),
											target: new $P.BubbleLink.End({object: table})
										}));

									d3.event.preventDefault();}

								function click(d, i) {
									var ringBubble;
									if (d3.event.defaultPrevented) {return;} // Don't trigger on drag.

									if (i == 0 || d.children == undefined)
										return;
									if (d.children.length == 0)
										return;
									var selectedData = d3.select(this).datum();//Clone Select data
									var name = selectedData.name;
									//var dataType = $(_this.parent.menu.element).find('#file').val();
									var dataType = this.dataType;

									var RingWidth = _this.parent.w;
									var RingHeight = _this.parent.h;
									if (d3.select(this).datum().depth >= 1) {
										RingWidth = RingWidth * 0.8;
										RingHeight = RingHeight * 0.8;
									}
									ringBubble = new $P.TreeRing(
										_this.parent.x + _this.parent.w - 40, _this.parent.y, RingWidth, RingHeight,
										selectedData.name, dataType, selectedData);
									ringBubble.experimentType = _this.parent.experimentType;
									if(_this.parent.preHierarchical!=='') {
										ringBubble.preHierarchical = _this.parent.preHierarchical + '->' + _this.parent.id;}
									else {
										ringBubble.preHierarchical +=  _this.parent.id;}
									ringBubble.orthologLabel=_this.parent.orthologLabel;
									ringBubble.expressionLabel=_this.parent.expressionLabel;
									ringBubble.menuHidden = _this.parent.menuHidden;

									_this.parent.parent.add(ringBubble);
									$P.state.scene.links.push(
										new $P.BubbleLink({
											source: new $P.D3TreeRing.BubbleLinkEnd({
												d3ring: _this,
												datum: d3.select(this).datum()}),
											target: new $P.BubbleLink.End({object: ringBubble})
										}));


									if (_this.customOrtholog) {
										ringBubble.svg.customOrtholog = _this.customOrtholog;
										ringBubble.minRatio = _this.parent.minRatio;
										ringBubble.maxRatio = _this.parent.maxRatio;
										ringBubble.crossTalkLevel = _this.parent.crossTalkLevel;
										ringBubble.file = _this.parent.file;
										ringBubble.operateText = _this.parent.operateText;
										ringBubble.upLabel = _this.parent.upLabel;
										ringBubble.downLabel = _this.parent.downLabel;}
									if (_this.customExpression) {
										d3.select(ringBubble.svg.element).selectAll('.symbol').remove();
										ringBubble.svg.customExpression = _this.customExpression;
										ringBubble.svg.expressionScaleMax = max;
										ringBubble.minRatio = _this.parent.minRatio;
										ringBubble.maxRatio = _this.parent.maxRatio;
										ringBubble.crossTalkLevel = _this.parent.crossTalkLevel;
										ringBubble.file = _this.parent.file;
										ringBubble.operateText = _this.parent.operateText;
										ringBubble.upLabel = _this.parent.upLabel;
										ringBubble.downLabel = _this.parent.downLabel;}
									d3.event.preventDefault();
								}

								if ('showTitle' === _this.parent.operateText) {
									d3.select(_this.parent.svg.element).selectAll('.link').style('opacity', 0);
									d3.select(_this.parent.svg.element).selectAll('.titleLink').style('opacity', 1);
									d3.select(_this.parent.svg.element).selectAll('.inner_node').style('opacity', 1);
									$(_this.parent.menu.element).find('#crossTalkLevel').hide();}
								else if ('showCrossTalk' === _this.parent.operateText) {
									d3.select(_this.parent.svg.element).selectAll('.titleLink').style('opacity', 0);
									d3.select(_this.parent.svg.element).selectAll('.inner_node').style('opacity', 0);
									d3.select(_this.parent.svg.element).selectAll('.link').style('opacity', 1);
									$(_this.parent.menu.element).find('#crossTalkLevel').show();
								}
							});

						}

						if (_this.parent.menuHidden == undefined || _this.parent.menuHidden !== true) {     //Color Bar for ortholog

							var scaleMargin = {top: 5, right: 5, bottom: 5, left: 5},
									scaleWidth = 30 - scaleMargin.left - scaleMargin.right,
									scaleHeight = 170 - scaleMargin.top - scaleMargin.bottom;
							var BarWidth = scaleWidth + scaleMargin.left + scaleMargin.right;
							var BarHeight = scaleHeight + scaleMargin.top + scaleMargin.bottom;

							var sectionHeight = 20;
							var texts = ['Partial', 'Complete', 'Empty'];
							var newData = [];
							for (var i = 0; i < 3; i++) {
								var obj = {};
								obj.data = i * 20;
								obj.text = texts[i];
								obj.color = colors[i];
								newData.push(obj);
							}
							var colorScaleBar = svg.append('g')
										.attr('class', 'colorScaleBar')
										.attr('transform', 'translate(' + (width - 100) + ',' + ( 25  ) + ')')
										.attr('width', BarWidth)
										.attr('height', BarHeight);

							colorScaleBar.selectAll('rect')
								.data(newData)
								.enter()
								.append('rect')
								.attr('x', 0)
								.attr('y', function (d) {
									return d.data;
								})
								.attr('height', sectionHeight)
								.attr('width', scaleWidth)

								.attr('fill', function (d) {
									return d.color;
								});
							colorScaleBar.selectAll('text')
								.data(newData)
								.enter().append('text')
								.style('font-size', 10)
								.attr('transform', 'translate(' + (scaleWidth / 2 + 10) + ',' + (sectionHeight) + ')')
								.attr('y', function (d, i) {
									return d.data - 5;
								})
								.attr('dy', '.1em')
								.style('text-anchor', 'start')
								.text(function (d, i) {
									return d.text;
								});
						}
						else
						{
							var scaleMargin = {top: 5, right: 5, bottom: 5, left: 5},
									scaleWidth = 30 - scaleMargin.left - scaleMargin.right,
									scaleHeight = 170 - scaleMargin.top - scaleMargin.bottom;
							var BarWidth = scaleWidth + scaleMargin.left + scaleMargin.right;
							var BarHeight = scaleHeight + scaleMargin.top + scaleMargin.bottom;

							var sectionHeight = 20;
							var uplabel = _this.parent.upLabel;
							var downlabel = _this.parent.downLabel;
							if (uplabel == '') {uplabel = 'Up expressed';}
							if (downlabel == '') {downlabel = 'Down expressed';}
							var texts = [downlabel, uplabel];     //'Down expressed', 'Up expressed'
							var expressedColors=['#0f0','#f00'];
							var newData = [];
							for (var i = 0; i < 2; ++i) {
								var obj = {};
								obj.data = (1 - i) * 20;
								obj.text = texts[i];
								obj.color = expressedColors[i];
								newData.push(obj);}
							var colorScaleBar = svg.append('g')
										.attr('class', 'colorScaleBar')
										.attr('transform', 'translate(' + (width - 30 - 80) + ',' + (  25  ) + ')')
										.attr('width', BarWidth)
										.attr('height', BarHeight);

							colorScaleBar.selectAll('rect')
								.data(newData)
								.enter()
								.append('rect')
								.attr('x', 0)
								.attr('y', function (d) {
									return d.data;
								})
								.attr('height', 20)
								.attr('width', 10)

								.attr('fill', function (d) {
									return d.color;
								});
							colorScaleBar.selectAll('text')
								.data(newData)
								.enter().append('text')
								.style('font-size', 10)
								.attr('transform', 'translate(' + (scaleWidth / 2 + 10) + ',' + (sectionHeight) + ')')
								.attr('y', function (d, i) {
									return d.data - 5;
								})
								.attr('dy', '.1em')
								.style('text-anchor', 'start')
								.text(function (d, i) {
									return d.text;
								});
						}
					}

				});
			});

			d3.select(self.frameElement).style('height', height + 'px');

		},
		showTitle: function () {
			d3.select(this.element).selectAll('.link').style('opacity', 0);
			d3.select(this.element).selectAll('.titleLink').style('opacity', 1);
			d3.select(this.element).selectAll('.inner_node').style('opacity', 1);
			$(this.element).find('#crossTalkLevel').hide();
		},
		showCrossTalk: function () {
			d3.select(this.element).selectAll('.titleLink').style('opacity', 0);
			d3.select(this.element).selectAll('.inner_node').style('opacity', 0);
			d3.select(this.element).selectAll('.link').style('opacity', 1);
			$(this.element).find('#crossTalkLevel').show();
		},
		/**
		 * Returns the ratio limits set by the user.
		 * @returns {Object} - a min and max value.
		 */
		getRatioLimits: function() {
			var menu = $(this.parent.menu.element);
			return {
				min: parseFloat(menu.find('#minRatio').val()) || -1.5,
				max: parseFloat(menu.find('#maxRatio').val()) || 1.5};},
		/**
		 * Gets a (cached) map of ids -> expression
		 */
		getExpressionMap: function() {
			var limits;
			if (!this.customExpression) {return {};}
			if (!this.expressionMap) {
				this.expressionMap = {};
				limits = this.getRatioLimits();
				this.customExpression.forEach(function(expression) {
					if (expression.ratio <= limits.min) {
						this.expressionMap[expression.symbol] = 'down';}
					else if (expression.ratio >= limits.max) {
						this.expressionMap[expression.symbol] = 'up';}
				}.bind(this));}
			return this.expressionMap;},
		/**
		 * Gets the expression for a specific id.
		 * @param {string} id - the id to retrieve
		 * @returns {?string} - up or down
		 */
		getExpression: function(id) {
			return this.getExpressionMap()[id.toUpperCase()];}
	});

$P.D3TreeRing.BubbleLinkEnd = $P.defineClass(
	$P.BubbleLink.End,
	function D3TreeRingBubbleLinkEnd(config) {
		this.ring = config.d3ring;
		console.log(this.ring);
		this.datum = config.datum;
		$P.BubbleLink.End.call(this, {object: this.ring.parent});
	},
	{
		get x() {
			return this.ring.x - 8 + this.ring.w * 0.5 + this.ring.zoomTranslate[0]
				+ this.datum.outsideEdge.x * this.ring.zoomScale;},
		get y() {
			return this.ring.y + 10 + (this.ring.h - 40) * 0.5 + this.ring.zoomTranslate[1]
				+ this.datum.outsideEdge.y * this.ring.zoomScale;}
	});

// old name
$P.D3Ring = $P.D3TreeRing;
