Ext.BLANK_IMAGE_URL = '/assets/components/bannery/img/_blank.png'

Ext.ux.Image = Ext.extend(Ext.Component, {
	url  : Ext.BLANK_IMAGE_URL  //for initial src value
	,autoEl: {
		tag: 'img'
		,src: Ext.BLANK_IMAGE_URL
		,cls: 'tng-managed-image'
		,width: 'auto'
		,height: 100
	}
//  Add our custom processing to the onRender phase.
//  We add a ‘load’ listener to our element.
	,onRender: function() {
		Ext.ux.Image.superclass.onRender.apply(this, arguments);
		this.el.on('load', this.onLoad, this);
		if(this.url){
			this.setSrc(this.url);
		}
	}
	,onLoad: function() {
		this.fireEvent('load', this);
	}
	,setSrc: function(src) {
		if(src == '' || src == undefined) {
			this.el.dom.src = Ext.BLANK_IMAGE_URL;
			Ext.getCmp('currimg').hide();
		}
		else {
			this.el.dom.src = MODx.config.connectors_url+'system/phpthumb.php?&src='+src+'&wctx=mgr&h=100&zc=0&source='+Bannery.config.media_source;
			Ext.getCmp('currimg').show();
		}
	}
});
Ext.reg('image', Ext.ux.Image);

Bannery.grid.Ads = function(config) {
	config = config || {};
	this.exp = new Ext.grid.RowExpander({
		expandOnDblClick: false
		,tpl : new Ext.Template('<p class="desc">{description}</p>')
		,renderer : function(v, p, record){return record.data.description != '' ? '<div class="x-grid3-row-expander">&#160;</div>' : '&#160;';}
	});
	Ext.applyIf(config,{
		id: 'bannery-grid-ads'
		,url: Bannery.config.connectorUrl
		,baseParams: { action: 'mgr/ads/getlist' }
		,fields: ['id','name', 'url', 'image', 'active', 'positions', 'clicks', 'description']
		,paging: true
		,border: false
		,frame: false
		,remoteSort: true
		,anchor: '97%'
		,autoExpandColumn: 'name'
		,plugins: this.exp
		,columns: [this.exp
			,{header: _('id'),dataIndex: 'id',sortable: true,width: 10}
			,{header: _('bannery.ads.name'),dataIndex: 'name',sortable: true}
			,{header: _('bannery.ads.url'),dataIndex: 'url',sortable: true}
			,{header: _('bannery.ads.clicks'),dataIndex: 'clicks',sortable: false}
			,{header: _('bannery.ads.active'),dataIndex: 'active',sortable: true, renderer: this.renderBoolean}
			,{header: _('bannery.ads.image'),dataIndex: 'image',sortable: false,renderer: {fn:function(img) {return renderGridImage(img,30)}}}
			,{header: _('bannery.ads.description'),dataIndex: 'description',sortable: false, hidden: true}
		]
		,tbar: [{
			text: _('bannery.ads.new')
			,handler: this.createAd
		},{
			xtype: 'tbfill'
		},{
			xtype: 'bannery-filter-positions'
			,id: 'bannery-grid-ads-positionsfilter'
			,width: 200
			,listeners: {'select': {fn: this.FilterByPosition, scope:this}}
		},{
			xtype: 'tbspacer'
			,width: 10
		}, {
			xtype: 'bannery-filter-byquery'
			,id: 'bannery-ads-filter-byquery'
			,listeners: {
				render: {fn: function(tf) {tf.getEl().addKeyListener(Ext.EventObject.ENTER, function() {this.FilterByQuery(tf);}, this);},scope: this}
			}
		},{
			xtype: 'bannery-filter-clear'
			,listeners: {click: {fn: this.FilterClear, scope: this}}
		}]
		,listeners: {
			rowDblClick: function(grid, rowIndex, e) {
				var row = grid.store.getAt(rowIndex);
				this.updateAd(grid, e, row);
			}
		}
	});

    //positions store/array for checkboxes in add/update window
    Bannery.positionsArray = new Array();
    Bannery.posStore = new Ext.data.JsonStore({
       url: Bannery.config.connectorUrl
      ,root: 'results'
      ,baseParams: { action: 'mgr/positions/getlist' }
      ,fields: ["id", "name"]
      ,autoLoad: true
      ,listeners: {
          load: function(t, records, options) {
				Bannery.positionsArray = new Array;
				for (var i=0; i<records.length; i++) {
					Bannery.positionsArray.push({name: "positions[]", inputValue: records[i].data.id, boxLabel: records[i].data.name});
				}
          }
      }
    });

    Bannery.grid.Ads.superclass.constructor.call(this,config);
};
Ext.extend(Bannery.grid.Ads,MODx.grid.Grid,{
	getMenu: function(grid,idx) {
		var row = grid.store.data.items[idx]
		var m = new Array;
		if (row.data.active == 0) {
			m.push({text: _('bannery.ads.enable'),handler: this.enableAd});
		}
		else {
			m.push({text: _('bannery.ads.disable'),handler: this.disableAd});
		}
		m.push(
			{text: _('bannery.ads.update'),handler: this.updateAd}
			,'-'
			,{text: _('bannery.ads.remove'),handler: this.removeAd}
		);
		this.addContextMenuItem(m);
		return true;
	}
	,FilterClear: function() {
		var s = this.getStore();
		s.baseParams.query = '';
		s.baseParams.position = '';
		Ext.getCmp('bannery-ads-filter-byquery').reset();
		Ext.getCmp('bannery-grid-ads-positionsfilter').reset();
		this.getBottomToolbar().changePage(1);
		this.refresh();
	}
	,FilterByQuery: function(tf, nv, ov) {
		var s = this.getStore();
		s.baseParams.query = tf.getValue();
		this.getBottomToolbar().changePage(1);
		this.refresh();
	}
	,FilterByPosition: function(combo, row, idx) {
		var s = this.getStore();
		s.baseParams.position = row.id;
		this.getBottomToolbar().changePage(1);
		this.refresh();
	}
	,createAd: function(btn,e) {
		if (Bannery.positionsArray.length == 0) {
			MODx.msg.alert(_('error'),_('bannery.error.no_positions'));
			Ext.getCmp('bannery-tabs').setActiveTab('bannery-positions');
			return false;
		}
		w = MODx.load({
			xtype: 'bannery-window-ad'
			,update: 0
			,openTo: '/'
            ,baseParams: {
                action: 'mgr/ads/create'
            }
			,listeners: {
				'success': {fn:this.refresh,scope:this}
				,'hide': {fn:function() {this.getEl().remove()}}
			}
		});
		w.setTitle(_('bannery.ads.new')).show(e.target,function() {w.setPosition(null,50)},this);
		Ext.getCmp('bannery-window-ad').reset();
		Ext.getCmp('currimg').setSrc('');
	}
	,updateAd: function(btn,e, row) {
		if (typeof(row) != 'undefined') {this.menu.record = row.data;}
		if (Bannery.positionsArray.length == 0) {
			MODx.msg.alert(_('error'),_('bannery.error.no_positions'));
			Ext.getCmp('bannery-tabs').setActiveTab('bannery-positions');
			return false;
		}
		var openTo = this.menu.record.image;
		if (openTo != '' && typeof openTo !== "undefined") {
			if (!/^\//.test(openTo)) {
				openTo = '/' + openTo;
			}
			if (!/$\//.test(openTo)) {
				var tmp = openTo.split('/')
				delete tmp[tmp.length - 1];
				tmp = tmp.join('/');
				openTo = tmp.substr(1)
			}
		}
		
		MODx.Ajax.request({
			url: Bannery.config.connectorUrl
			,params: {
				action: 'mgr/ads/get'
				,id: this.menu.record.id
			}
			,listeners: {
				'success': {fn:function(r) {
					var record = r.object;

					w = MODx.load({
						xtype: 'bannery-window-ad'
						,update: 1
						,openTo: openTo
						,listeners: {
							'success': {fn:this.refresh,scope:this}
							,'hide': {fn:function() {this.getEl().remove()}}
						}
					});

					record.newimage = record.image;
					w.setTitle(_('bannery.ads.update')).show(e.target,function() {w.setPosition(null,50)},this);
					Ext.getCmp('bannery-window-ad').reset();
					Ext.getCmp('bannery-window-ad').setValues(record);
					this.enablePositions(record.positions);
					Ext.getCmp('currimg').setSrc(record.image);
				},scope:this}
			}
		});
	}
	,removeAd: function() {
		MODx.msg.confirm({
			title: _('bannery.ads.remove')
			,text: _('bannery.ads.remove.confirm')
			,url: this.config.url
			,params: {
				action: 'mgr/ads/remove'
				,id: this.menu.record.id
			}
			,listeners: {
				'success': {fn:this.refresh,scope:this}
			}
		});
	}
	,enableAd: function() {
		MODx.Ajax.request({
			url: Bannery.config.connectorUrl
			,params: {
				action: 'mgr/ads/enable'
				,id: this.menu.record.id
			}
			,listeners: {
				'success': {fn:this.refresh,scope:this}
			}
		})
	}
	,disableAd: function() {
		MODx.Ajax.request({
			url: Bannery.config.connectorUrl
			,params: {
				action: 'mgr/ads/disable'
				,id: this.menu.record.id
			}
			,listeners: {
				'success': {fn:this.refresh,scope:this}
			}
		})
	}
	,enablePositions: function(positions) {
		var checkboxgroup = Ext.getCmp('positions');
		Ext.each(checkboxgroup.items.items, function(item) {
			if( positions.indexOf(item.inputValue) !== -1) {
				item.setValue(true);
			}
			else {
				item.setValue(false);
			}
		});
	}
	,renderBoolean: function(value) {
		if (value == 1) {return '<span style="color:green;">'+_('yes')+'</span>';}
		else {return '<span style="color:red;">'+_('no')+'</span>';}
	}
});
Ext.reg('bannery-grid-ads',Bannery.grid.Ads);

Bannery.window.Ad = function(config) {
	config = config || {};
	Ext.applyIf(config,{
		id: 'bannery-window-ad'
		,title: _('bannery.ads.new')
		,url: Bannery.config.connectorUrl
		//,fileUpload: true
		,modal: true
		,width: 600
		,baseParams: {
			action: 'mgr/ads/update'
		}
		,fields: [{
				xtype: 'hidden'
				,name: 'id'
			},{
				xtype: 'hidden'
				,name: 'image'
				,anchor: '99%'
				,id: 'image'
			},{
				xtype: 'textfield'
				,fieldLabel: _('bannery.ads.name')
				,name: 'name'
				,anchor: '99%'
				,allowBlank: false
			},{
				items: [{
					layout: 'form'
					,items: [{
						layout: 'column'
						,border: false
						,items: [{
							columnWidth: .8
							,border: false
							,layout: 'form'
							,items: [{
								xtype: 'bannery-filter-resources'
								,fieldLabel: _('bannery.ads.url')
								,name: 'url'
								,description: _('bannery.ads.url.description')
								,anchor: '99%'
								,allowBlank: true
							}]
						},{
							columnWidth: .2
							,border: false
							,layout: 'form'
							,items: [{
								xtype: 'xcheckbox'
								,fieldLabel: _('bannery.ads.active')
								,name: 'active'
								,inputValue: 1
							}]
						}]
					}]
				}]
			},{
				id: 'currimg'
				,fieldLabel: _('bannery.ads.image.current')
				,xtype: 'image'
			},{
				xtype: 'modx-combo-browser'
				,fieldLabel: config.update ? '' : _('bannery.ads.image.new')
				,name: 'newimage'
				,source: Bannery.config.media_source
				,hideFiles: true
				,anchor: '99%'
				,allowBlank: true
				,openTo: config.openTo || '/'
				,listeners: {
					'select': {
						fn:function(data) {
							Ext.getCmp('currimg').setSrc(data.relativeUrl);
							Ext.getCmp('image').setValue(data.relativeUrl);
						}, scope:this
					}, 'change' : {
						fn:function(cb,nv) {
							Ext.getCmp('image').setValue(nv);
							this.fireEvent('select', {
								relativeUrl:nv
								,url:nv
							});
						},scope:this
					}
				}
			},{
				xtype: 'textarea'
				,fieldLabel: _('bannery.ads.description')
				,name: 'description'
				,anchor: '99%'
				,height: 100
				,allowBlank: true
				,resize: true
			},{
				xtype: 'checkboxgroup'
				,id: 'positions'
				,columns: 3
				,items: Bannery.positionsArray
				,fieldLabel: _('bannery.positions')
				,name: 'positions'
			}
		]
		,keys: [{
			key: Ext.EventObject.ENTER
			,shift: true
			,fn:  function() {this.submit()}
			,scope: this
		}]
	});
	Bannery.window.Ad.superclass.constructor.call(this,config);
};
Ext.extend(Bannery.window.Ad,MODx.Window);
Ext.reg('bannery-window-ad',Bannery.window.Ad);