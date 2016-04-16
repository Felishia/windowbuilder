/**
 * Аналог УПзП-шного __ЦенообразованиеСервер__
 *
 * Created 26.05.2015<br />
 * &copy; http://www.oknosoft.ru 2014-2015
 * @author	Evgeniy Malyarov
 * @module  glob_pricing
 */

$p.modifiers.push(
	function($p){

		$p.pricing = new Pricing($p);

		// методы ценообразования в прототип номенклатуры
		$p.cat.nom._obj_constructor.prototype.__define({

			/**
			 * Возвращает цену номенклатуры указанного типа
			 * - на дату
			 * - с подбором характеристики по цвету
			 * - с пересчетом из валюты в валюту
			 */
			_price: {
				value: function (attr) {
					
					if(!attr)
						attr = {};

					if(!attr.price_type)
						attr.price_type = $p.job_prm.pricing.price_type_sale;
					else if($p.is_data_obj(attr.price_type))
						attr.price_type = attr.price_type.ref;

					if(!attr.characteristic)
						attr.characteristic = $p.blank.guid;
					else if($p.is_data_obj(attr.characteristic))
						attr.characteristic = attr.characteristic.ref;

					if(!attr.currency || attr.currency.empty())
						attr.currency = $p.job_prm.pricing.main_currency;

					if(!attr.date)
						attr.date = new Date();

					var price = 0, currency, date = $p.blank.date;

					if(this._data._price){
						if(this._data._price[attr.characteristic]){
							if(this._data._price[attr.characteristic][attr.price_type]){
								this._data._price[attr.characteristic][attr.price_type].forEach(function (row) {
									if(row.date > date && row.date <= attr.date){
										price = row.price;
										currency = row.currency;
									}
								})
							}
						}else if(attr.clr){

						}
					}

					// Пересчитать из валюты в валюту
					if(currency && currency != attr.currency){

					}
					
					return price;

				}
			}
		});



		function Pricing($p){

			/**
			 * Возвращает цену номенклатуры по типу цен из регистра пзМаржинальныеКоэффициентыИСкидки
			 * Если в маржинальных коэффициентах или номенклатуре указана формула - выполняет
			 *
			 * Аналог УПзП-шного __ПолучитьЦенуНоменклатуры__
			 * @method nom_price
			 * @param nom
			 * @param characteristic
			 * @param price_type
			 * @param prm
			 * @param row
			 */
			this.nom_price = function (nom, characteristic, price_type, prm, row) {

				if(row && prm){
					var calc_order = prm.calc_order_row._owner._owner;
					row.price = nom._price({
						price_type: price_type,
						characteristic: characteristic,
						date: calc_order.date,
						currency: calc_order.contract.settlements_currency
					});

					return row.price;
				}
			};

			/**
			 * Возвращает структуру типов цен и КМарж
			 * Аналог УПзП-шного __ПолучитьТипЦенНоменклатуры__
			 * @method price_type
			 * @param prm {Object}
			 * @param prm.calc_order_row {TabularSectionRow.doc.calc_order.production}
			 */
			this.price_type = function (prm) {

				// Рез = Новый Структура("КМарж, КМаржМин, КМаржВнутр, Скидка, СкидкаВнешн, НаценкаВнешн, ТипЦенСебестоимость, ТипЦенПрайс, ТипЦенВнутр,
				// 				|Формула, ФормулаПродажа, ФормулаВнутр, ФормулаВнешн",
				// 				1.9, 1.2, 1.5, 0, 10, 0, ТипЦенПоУмолчанию, ТипЦенПоУмолчанию, ТипЦенПоУмолчанию, "", "", "",);
				prm.price_type = {
					marginality: 1.9,
					marginality_min: 1.2,
					marginality_internal: 1.5,
					discount: 0,
					discount_external: 10,
					extra_charge_external: 0,
					price_type_first_cost: $p.job_prm.pricing.price_type_first_cost,
					price_type_sale: $p.job_prm.pricing.price_type_first_cost,
					price_type_internal: $p.job_prm.pricing.price_type_first_cost,
					formula: "",
					sale_formula: "",
					internal_formula: "",
					external_formula: ""
				};

				var filter = prm.calc_order_row.nom.price_group.empty() ?
					{price_group: prm.calc_order_row.nom.price_group} :
					{price_group: {in: [prm.calc_order_row.nom.price_group, $p.cat.price_groups.get()]}},
					ares = [];

				$p.ireg.margin_coefficients.find_rows(filter, function (row) {
					ares.push(row);
				});

				// заглушка - фильтр только по ценовой группе
				if(ares.length)
					Object.keys(prm.price_type).forEach(function (key) {
						prm.price_type[key] = ares[0][key];
					});

				return prm.price_type;
			};


			/**
			 * Рассчитывает плановую себестоимость строки документа Расчет
			 * Если есть спецификация, расчет ведется по ней. Иначе - по номенклатуре строки расчета
			 *
			 * Аналог УПзП-шного __РассчитатьПлановуюСебестоимость__
			 * @param prm {Object}
			 * @param prm.calc_order_row {TabularSectionRow.doc.calc_order.production}
			 */
			this.calc_first_cost = function (prm) {

				var marginality_in_spec = $p.job_prm.pricing.marginality_in_spec,
					fake_row = {};

				if(!prm.spec)
					return;

				// пытаемся рассчитать по спецификации
				if(prm.spec.count()){
					prm.spec.each(function (row) {

						$p.pricing.nom_price(row.nom, row.characteristic, prm.price_type.price_type_first_cost, prm, row);
						row.amount = row.price * row.totqty1;

						if(marginality_in_spec){
							fake_row._mixin(row, ["nom"]);
							tmp_price = $p.pricing.nom_price(row.nom, row.characteristic, prm.price_type.price_type_sale, prm, fake_row);
							row.amount_marged = (tmp_price ? tmp_price : row.price) * row.totqty1;
						}

					});
					prm.calc_order_row.first_cost = prm.spec.aggregate([], ["amount"]).round(2);
				}else{
					// TODO: реализовать расчет себестомиости по номенклатуре строки расчета
				}
				
				
				
				
			};

			/**
			 * Рассчитывает стоимость продажи в строке документа Расчет
			 * 
			 * Аналог УПзП-шного __РассчитатьСтоимостьПродажи__
			 * @param prm {Object}
			 * @param prm.calc_order_row {TabularSectionRow.doc.calc_order.production}
			 */
			this.calc_amount = function (prm) {

				// TODO: реализовать расчет цены продажи по номенклатуре строки расчета
				var price_cost = $p.job_prm.pricing.marginality_in_spec ? prm.spec.aggregate([], ["amount_marged"]) : 0;

				// цена продажи
				if(price_cost)
					prm.calc_order_row.price = price_cost.round(2);
				else
					prm.calc_order_row.price = (prm.calc_order_row.first_cost * prm.price_type.marginality).round(2);

				// КМарж в строке расчета
				prm.calc_order_row.marginality = prm.calc_order_row.first_cost ? prm.calc_order_row.price / prm.calc_order_row.first_cost : 0;

				// TODO: Рассчитаем цену и сумму ВНУТР или ДИЛЕРСКУЮ цену и скидку

				// TODO: вытягивание строк спецификации в заказ


			};

			// виртуальный срез последних
			function build_cache() {

				return $p.doc.nom_prices_setup.pouch_db.query("nom_prices_setup/slice_last",
					{
						limit : 1000,
						include_docs: false,
						startkey: [''],
						endkey: ['\uffff'],
						reduce: function(keys, values, rereduce) {
							return values.length;
						}
					})
					.then(function (res) {
						res.rows.forEach(function (row) {

							var onom = $p.cat.nom.get(row.key[0], false, true);

							if(!onom._data._price)
								onom._data._price = {};

							if(!onom._data._price[row.key[1]])
								onom._data._price[row.key[1]] = {};

							if(!onom._data._price[row.key[1]][row.key[2]])
								onom._data._price[row.key[1]][row.key[2]] = [];

							onom._data._price[row.key[1]][row.key[2]].push({
								date: new Date(row.value.date),
								price: row.value.price,
								currency: $p.cat.currencies.get(row.value.currency)
							});

						});
					});
			}

			// подписываемся на событие после загрузки из pouchdb-ram и готовности предопределенных
			var init_event_id = $p.eve.attachEvent("predefined_elmnts_inited", function () {
				$p.eve.detachEvent(init_event_id);
				build_cache();
			});

			// следим за изменениями документа установки цен, чтобы при необходимости обновить кеш
			$p.eve.attachEvent("pouch_change", function (dbid, change) {
				if (dbid != $p.doc.nom_prices_setup.cachable)
					return;

				// формируем новый
			});
		}

	}
);
