// ==UserScript==
// @name        kittensGame
// @namespace   http://devars.duckdns.org
// @description resource enhancements for kittensGame
// @match       http://bloodrizer.ru/games/kittens*
// @version     2.13.11
// @grant       none
// ==/UserScript==

'use strict';

let DV_RATE = 20,
    DV_DAY_PER_TICK = 4 / DV_RATE,
    DV_DAYS = 1 / DV_DAY_PER_TICK,
    DV_YEARS = 400 * DV_DAYS,
    // set to 100 to always prefer trading with the latest discovered race
    DV_TRADE_WITH_PREFERRED_RACE_CHANCE = 50,
    // this is a ratio of the total resources we can trade
    // 2 is 1/2, 3 is 1/3, n is 1/10
    // only trade 1/10th of our total resource
    DV_TRADEABLE_RESOURCE_RATIO = 3,
    DV_MIN_CARAVANS_TO_TRADE = 5,
    // this is a ratio of total manpower used in hunting: 2 is 1/2, 3 is 1/3, n is 1/n
    DV_HUNT_PARTIAL_MANPOWER_RATE = 10,
    DV_CRAFT_THRESHOLD = 300,
    // save every 5 years
    DV_AUTOSAVE_TICKS = 5 * DV_YEARS,
    // clear logs every year
    DV_CLEAR_LOG_RATE = 1 * DV_YEARS,
    // craft every 53 days
    DV_RESCRAFT_RATE = 53 * DV_DAYS,
    // hunt every 5 days
    DV_SEND_HUNTERS_RATE = 67 * DV_DAYS,
    // praise every 100 days
    DV_PRAISE_THE_SUN_RATE = 500 * DV_YEARS,
    // trade every 11 days
    DV_TRADE_RATE = 73 * DV_DAYS,
    // simulate clicking "gather catnip" and increase your catnip by this amount
    DV_CATNIP_TICK_GATHER_RATE = 10,
    c = com.nuclearunicorn.game,
    cm = classes.managers,
    gpp = c.ui.GamePage.prototype,
    tmr = c.ui.Timer.prototype,
    cal = c.Calendar.prototype,
    vlm = cm.VillageManager.prototype,
    rlm = cm.ReligionManager.prototype,
    wsm = cm.WorkshopManager.prototype,
    rsm = cm.ResourceManager.prototype,
    resCraft = [{
      name: 'compedium',
      ratio: 2,
      craft: convert_fn,
      args: ['blueprint', wsm, arguments]
    },{
      name: 'manuscript',
      ratio: 3,
      craft: convert_fn,
      args: ['compedium', wsm, arguments]
    }, {
      name: 'parchment',
      ratio: 4,
      craft: convert_fn,
      args: ['manuscript', wsm, arguments]
    }, {
      name: 'furs',
      min: 1000,
      ratio: 5,
      craft: convert_fn,
      args: ['parchment', wsm, arguments]
    }, {
      name: ['oil'],
      ratio: 2,
      craft: convert_fn,
      args: ['kerosene', wsm, arguments]
    }, {
      name: ['titanium', 'steel'],
      ratio: 2,
      craft: convert_fn,
      args: ['alloy', wsm, arguments]
    }, {
      name: ['slab', 'steel'],
      ratio: 2,
      craft: convert_fn,
      args: ['concrate', wsm, arguments]
    }, {
      name: ['steel'],
      ratio: 2,
      craft: convert_fn,
      args: ['gear', wsm, arguments]
    }, {
      name: ['beam', 'slab', 'plate'],
      ratio: 5,
      craft: convert_fn,
      args: ['megalith', wsm, arguments]
    }, {
      name: 'beam',
      ratio: 3,
      craft: convert_fn,
      args: ['scaffold', wsm, arguments]
    }, {
      name: 'coal',
      craft: convert_fn,
      args: ['steel', wsm, arguments]
    }, {
      name: 'wood',
      craft: convert_fn,
      ratio: 4,
      args: ['beam', wsm, arguments]
    }, {
      name: 'minerals',
      craft: convert_fn,
      ratio: 4,
      args: ['slab', wsm, arguments]
    }, {
      name: 'iron',
      craft: convert_fn,
      ratio: 4,
      args: ['plate', wsm, arguments]
    }, {
      name: 'catnip',
      min: 20000,
      ratio: 5,
      craft: convert_fn,
      args: ['wood', wsm, arguments]
    }];

gpp.rate = DV_RATE;
gpp.autosaveFrequency = DV_AUTOSAVE_TICKS;
gpp.useWorkers = true;
// gpp.updateResources = updateResources;
gpp.oldTick = gpp.tick;
gpp.tick = tick;
cal.dayPerTick = DV_DAY_PER_TICK;
tmr.oldAddEvent = tmr.addEvent;
tmr.addEvent = addEvent;
tmr.update = timerUpdate;
rsm.update = resourceManagerUpdate;
rsm.addResAmt = resourceManagerAddResourceAmount;

function addEvent (handler, frequency) {
  tmr.oldAddEvent.apply(tmr, [handler, frequency * DV_RATE / 10, arguments]);
}

function timerUpdate () {
  for (let i = 0; i < this.handlers.length; i++) {
    let h = this.handlers[i];
    h.phase--;
    if (h.phase <= 0) {
      h.phase = h.frequency;
      window.setTimeout(h.handler, 0);
    }
  }
}

function resourceManagerUpdate () {
  let effectsBase = this.addBarnWarehouseRatio(this.game.bld.effectsBase);
    for (let i = 0; i < this.resources.length; i++){
      let res = this.resources[i],
          resPerTick = this.game.getResourcePerTick(res.name) || 0,
          maxValue = this.game.bld.getEffectCached(res.name + "Max") || 0;
      maxValue += (effectsBase[res.name + "Max"] || 0);
      maxValue += this.game.workshop.getEffect(res.name + "Max");
      maxValue += this.game.space.getEffect(res.name + "Max");
      maxValue += maxValue * this.game.workshop.getEffect(res.name + "MaxRatio");
      maxValue += maxValue * this.game.prestige.getParagonStorageRatio();;
      res.value = res.value + resPerTick;
      res.maxValue = maxValue;
      if (isNaN(res.value) || res.value < 0){
      	res.value = 0;	//safe switch
      }
    }
    //--------
    this.energyProd = this.game.getEffect("energyProduction");
    this.energyCons = this.game.getEffect("energyConsumption");
}

function resourceManagerAddResourceAmount (name, value) {
  let res = this.get(name);
  if (value){
    res.value += value;
  }
  if (res.value < 0){
    res.value = 0;
  }
}

function updateResources () {
  for (let i = 0; i < this.resPool.resources.length; i++) {
    let res = this.resPool.resources[i],
        resRatioTick = this.getEffect(res.name + 'PerTick'),
        dvRatioTick = resRatioTick * Math.pow(1 + resRatioTick, 2),
        perTickNoAutomate = this.calcResourcePerTick(res.name),
        dvPerTickNoAutomate = perTickNoAutomate * Math.pow(1 + perTickNoAutomate, 2),
        kindaTotal = resRatioTick + perTickNoAutomate;

    // if (kindaTotal > 0) {
      res.perTickNoAutomate = dvPerTickNoAutomate;
      res.perTickUI = dvRatioTick + dvPerTickNoAutomate;
    /*} else {
      res.perTickNoAutomate = perTickNoAutomate;
      res.perTickUI = kindaTotal;
    }*/
  }
}

function convert_fn (res_name, craft_parent, res_min) {
  let workshop = this.workshop,
      craft_item = workshop.getCraft(res_name);

  if (craft_item.unlocked) {
    let max_craftable = workshop.getCraftAllCount(res_name),
        craft_amount = 1 + Math.floor(max_craftable * 0.33);
    if (craft_amount === 0) return;
    if (max_craftable > DV_CRAFT_THRESHOLD) {
      workshop.craft(res_name, max_craftable * 0.333, true);
    } else if (max_craftable > 100) {
      workshop.craft(res_name, 100, true);
    } else if (max_craftable > 0) {
      workshop.craft(res_name, craft_amount, true);
    }
  }
}

function trade_with (race_name, max_caravans) {
  let race_panel, trade_btn;
  for (let i = 0, len = this.racePanels.length; i < len; i++) {
    let current_race_panel = this.racePanels[i],
        current_race = current_race_panel.race,
        current_race_name = current_race.name;
        if (current_race_name === race_name) {
          race_panel = current_race_panel;
          break;
        }
  }
  if (race_panel) {
    trade_btn = race_panel.tradeBtn;
    for (let trade_amount = max_caravans; trade_amount > 0; trade_amount--) {
      if (trade_btn.hasMultipleResources(trade_amount)) {
        let we_can_only_trade_this_much = Math.floor(trade_amount / DV_TRADEABLE_RESOURCE_RATIO);
        if (we_can_only_trade_this_much < DV_MIN_CARAVANS_TO_TRADE) {
          log('Trying to trade with', race_name, 'but we can only send',
            we_can_only_trade_this_much, 'caravans.  We need at least',
            DV_MIN_CARAVANS_TO_TRADE, 'caravans to trade.');
          return false;
        }
        log('Sending', we_can_only_trade_this_much, 'caravans to', race_name, '.');
        trade_btn.tradeMultiple(we_can_only_trade_this_much);
        return true;
      }
    }
  }
  return false;
}

function hunt_with_partial_manpower() {
  let manpower = this.game.resPool.get("manpower"),
      hunt_squads = Math.floor(manpower.value / 100 / DV_HUNT_PARTIAL_MANPOWER_RATE);
  if (hunt_squads < 1) {
    return;
  }
  log('Sending', hunt_squads, 'hunters.');
  manpower.value -= hunt_squads * 100;
  for (let i = hunt_squads - 1; i >= 0; i--) {
    this.sendHuntersInternal();
  }
}

function tick () {
  let game = this;
  game.resPool.get('catnip').value += DV_CATNIP_TICK_GATHER_RATE;
  game.oldTick.apply(game, arguments);
  if (game.ticks % DV_DAYS === 0 && game.calendar.observeBtn) {
    game.calendar.observeBtn.click();
  }
  if (game.ticks % DV_PRAISE_THE_SUN_RATE === 0) {
    praise_the_sun(game);
  }
  if (game.ticks % DV_SEND_HUNTERS_RATE === 0) {
    send_hunters(game);
  }
  if (game.ticks % DV_TRADE_RATE === 0) {
    trade_resources(game);
  }
  if (game.ticks % DV_RESCRAFT_RATE === 0) {
    auto_craft(game);
  }
  if (game.ticks % DV_CLEAR_LOG_RATE === 0) {
    game.clearLog();
  }
}

function auto_craft (game) {
  log('Running auto-craft.');
  resCraft.forEach(function (res) {
    let scope = res.scope ? game[res.scope] : game,
        is_craftable = true,
        resources = (typeof res.name !== 'object' && !res.name.forEach) ?
                    [res.name] : res.name,
        craft = res.args[0] || undefined;
    res.args = res.args || arguments;
    res.min = res.min || 0;
    if (craft && res.ratio) {
      // check if ratio is enforced
      for (let i = 0, len = resources.length; i < len; i++) {
        let main_resource = resources[i],
            src = game.resPool.get(main_resource),
            dest = game.resPool.get(craft);
        if (src.value < dest.value * res.ratio + 1) {
          return;
        }
      }
    }
    for (let i = 0, len = resources.length; i < len; i++) {
      let resource = game.resPool.get(resources[i]);
      if (resource.value < (resource.maxValue * 0.95) || resource.value <= res.min) {
        is_craftable = false;
        break;
      }
    }
    if (is_craftable) {
      res.craft.apply(scope, res.args);
    }
  });
}

function send_hunters (game) {
  let scope = game['village'];
  hunt_with_partial_manpower.apply(scope);
}

function praise_the_sun (game) {
  let scope = game['religion'],
      faith = game.resPool.get("faith");
  if (faith.value > faith.maxValue) {
    log('Making the kittens praise the sun.');
    rlm.praise.apply(scope);
  }
}

function trade_resources (game) {
  let scope = game['diplomacyTab'],
      manpower = game.resPool.get('manpower'),
      max_caravans = Math.floor(manpower.value / 50 / 2),
      trade_partners = ['dragons', 'zebras', 'spiders', 'lizards', 'griffins'],
      already_traded = false;
  for (let i = 0, len = trade_partners.length; i < len && !already_traded; i++) {
    let current_trader = trade_partners[i],
        chance_to_trade = Math.random() * 100,
        can_we_trade_with_this_race =
          chance_to_trade < DV_TRADE_WITH_PREFERRED_RACE_CHANCE;
    if (can_we_trade_with_this_race) {
      already_traded = trade_with.apply(scope, [current_trader, max_caravans]);
    }
  }
}

function log () {
  let message = '';
  if (arguments && arguments.length) {
    message = Array.prototype.join.apply(arguments, [' ']);
  }
  game.msg('dvKittensGameHelper:: ' + message, null, 'dv Kittens Game Helper')
}
