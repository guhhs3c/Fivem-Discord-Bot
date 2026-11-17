// Referensi resmi FiveM per bahasa + snippet dasar & per-topik.
// Sumber: docs.fivem.net (Cfx.re Docs)

export const LANGUAGES = {
  lua: {
    label: 'Lua',
    color: 0x2980b9,
    gettingStarted: 'https://docs.fivem.net/docs/scripting-manual/introduction/creating-your-first-script/',
    reference: 'https://docs.fivem.net/docs/scripting-reference/runtimes/lua/',
    runtime: 'https://docs.fivem.net/docs/scripting-manual/runtimes/lua/',
    snippet:
      "-- client.lua\nRegisterCommand('hello', function(source, args)\n" +
      "  TriggerEvent('chat:addMessage', { args = { 'Halo, ' .. (args[1] or 'dunia') .. '!' } })\n" +
      "end, false)\n\n" +
      "-- Mendengarkan event\nAddEventHandler('onClientResourceStart', function(resourceName)\n" +
      "  if GetCurrentResourceName() ~= resourceName then return end\n" +
      "  print('Resource ' .. resourceName .. ' sudah jalan!')\n" +
      "end)",
  },
  csharp: {
    label: 'C#',
    color: 0x9b59b6,
    gettingStarted:
      'https://docs.fivem.net/docs/scripting-manual/introduction/creating-your-first-script-csharp/',
    reference: 'https://docs.fivem.net/docs/scripting-reference/runtimes/csharp/',
    runtime: 'https://docs.fivem.net/docs/scripting-manual/runtimes/csharp/',
    snippet:
      'using CitizenFX.Core;\nusing static CitizenFX.Core.Native.API;\n\n' +
      'public class Main : BaseScript\n{\n' +
      '    public Main()\n    {\n' +
      "        RegisterCommand(\"hello\", new Action<int, List<object>, string>((source, args, raw) =>\n" +
      '        {\n' +
      '            TriggerEvent("chat:addMessage", new { args = new[] { "Halo dari C#!" } });\n' +
      '        }), false);\n' +
      '    }\n}',
  },
  js: {
    label: 'JavaScript',
    color: 0xf1c40f,
    gettingStarted:
      'https://docs.fivem.net/docs/scripting-manual/introduction/creating-your-first-script-javascript/',
    reference: 'https://docs.fivem.net/docs/scripting-reference/runtimes/javascript/',
    runtime: 'https://docs.fivem.net/docs/scripting-manual/runtimes/javascript/',
    snippet:
      "// client.js\nRegisterCommand('hello', (source, args) => {\n" +
      "  emit('chat:addMessage', { args: [`Halo, ${args[0] || 'dunia'}!`] });\n" +
      "}, false);\n\n" +
      "on('onClientResourceStart', (resourceName) => {\n" +
      '  if (GetCurrentResourceName() !== resourceName) return;\n' +
      "  console.log(`Resource ${resourceName} sudah jalan!`);\n" +
      '});',
  },
};

// Link umum yang sama untuk semua bahasa (natives, manifest, server hosting, dll)
export const GENERAL_LINKS = {
  natives: {
    title: 'Native Functions (semua)',
    url: 'https://docs.fivem.net/natives/',
  },
  resourceManifest: {
    title: 'Resource Manifest (fxmanifest.lua)',
    url: 'https://docs.fivem.net/docs/scripting-reference/resource-manifest/resource-manifest/',
  },
  serverCommands: {
    title: 'Server Commands Reference',
    url: 'https://docs.fivem.net/docs/server-manual/server-commands/',
  },
  serverHosting: {
    title: 'FiveM Server Hosting (resmi)',
    url: 'https://fivem.net/server-hosting',
  },
  serverSetup: {
    title: 'Setting up a FiveM Server',
    url: 'https://docs.fivem.net/docs/server-manual/setting-up-a-server/',
  },
};

// Topik spesifik: dokumentasinya 1 halaman untuk semua bahasa (dengan tab kode),
// jadi url-nya sama, tapi snippet contoh dibuat per bahasa.
export const TOPICS = {
  commands: {
    title: 'Creating Commands',
    url: 'https://docs.fivem.net/docs/scripting-manual/migrating-from-deprecated/creating-commands/',
    snippets: {
      lua:
        "RegisterCommand('give', function(source, args, rawCommand)\n" +
        '  local targetId = tonumber(args[1])\n' +
        "  local item = args[2] or 'unknown'\n" +
        "  print(('Player %s memberi %s ke %s'):format(source, item, targetId))\n" +
        'end, false) -- false = boleh dipakai semua player, true = admin only (ACL)',
      csharp:
        'RegisterCommand("give", new Action<int, List<object>, string>((source, args, raw) =>\n' +
        '{\n' +
        '    var targetId = args.Count > 0 ? Convert.ToInt32(args[0]) : 0;\n' +
        '    Debug.WriteLine($"Player {source} memberi item ke {targetId}");\n' +
        '}), false);',
      js:
        "RegisterCommand('give', (source, args, rawCommand) => {\n" +
        '  const targetId = parseInt(args[0]);\n' +
        "  const item = args[1] || 'unknown';\n" +
        '  console.log(`Player ${source} memberi ${item} ke ${targetId}`);\n' +
        '}, false); // false = semua player boleh, true = admin only (ACL)',
    },
  },
  events: {
    title: 'Working with Events',
    url: 'https://docs.fivem.net/docs/scripting-manual/working-with-events/listening-for-events/',
    snippets: {
      lua:
        "-- Mendengarkan event\nAddEventHandler('playerSpawned', function()\n" +
        "  print('Player baru saja spawn')\n" +
        'end)\n\n' +
        "-- Trigger event ke server\nTriggerServerEvent('myResource:doSomething', 'data')\n\n" +
        "-- Trigger event ke semua client (server-side)\nTriggerClientEvent('myResource:notify', -1, 'Halo semua!')",
      csharp:
        'EventHandlers["playerSpawned"] += new Action(() =>\n' +
        '{\n' +
        '    Debug.WriteLine("Player baru saja spawn");\n' +
        '});\n\n' +
        '// Trigger event ke server\n' +
        'TriggerServerEvent("myResource:doSomething", "data");',
      js:
        "on('playerSpawned', () => {\n" +
        "  console.log('Player baru saja spawn');\n" +
        '});\n\n' +
        "// Trigger event ke server\nemitNet('myResource:doSomething', 'data');\n\n" +
        "// Trigger event ke semua client (server-side)\nemitNet('myResource:notify', -1, 'Halo semua!');",
    },
  },
  exports: {
    title: 'Exports (memanggil fungsi antar resource)',
    url: 'https://docs.fivem.net/docs/scripting-manual/runtimes/lua/#exports',
    snippets: {
      lua:
        "-- Resource A: mendaftarkan export\nexports('GetPlayerCoins', function(playerId)\n" +
        '  return 100\n' +
        'end)\n\n' +
        "-- Resource B: memanggil export dari resource A\nlocal coins = exports['resourceA']:GetPlayerCoins(source)",
      csharp:
        '// Resource A: mendaftarkan export\n' +
        'Exports.Add("GetPlayerCoins", new Func<int, int>((playerId) => 100));\n\n' +
        '// Resource B: memanggil export dari resource A\n' +
        'var coins = Exports["resourceA"].GetPlayerCoins(source);',
      js:
        "// Resource A: mendaftarkan export\nexports('GetPlayerCoins', (playerId) => {\n" +
        '  return 100;\n' +
        '});\n\n' +
        "// Resource B: memanggil export dari resource A\nconst coins = exports['resourceA'].GetPlayerCoins(source);",
    },
  },
  statebags: {
    title: 'State Bags',
    url: 'https://docs.fivem.net/docs/scripting-manual/networking/state-bags/',
    snippets: {
      lua:
        "-- Set state (replicate otomatis ke client)\nEntity(vehicle).state.locked = true\n\n" +
        "-- Dengarkan perubahan state\nAddStateBagChangeHandler('locked', nil, function(bagName, key, value)\n" +
        "  print('Status kunci berubah jadi: ' .. tostring(value))\n" +
        'end)',
      csharp:
        '// Set state (replicate otomatis ke client)\n' +
        'vehicle.State["locked"] = true;\n\n' +
        '// Dengarkan perubahan state\n' +
        'StateBag.AddStateBagChangeHandler("locked", null, (bagName, key, value, reserved, replicated) =>\n' +
        '{\n' +
        '    Debug.WriteLine($"Status kunci berubah jadi: {value}");\n' +
        '});',
      js:
        '// Set state (replicate otomatis ke client)\n' +
        "Entity(vehicle).state.set('locked', true, true);\n\n" +
        '// Dengarkan perubahan state\n' +
        "AddStateBagChangeHandler('locked', null, (bagName, key, value) => {\n" +
        '  console.log(`Status kunci berubah jadi: ${value}`);\n' +
        '});',
    },
  },
  nui: {
    title: 'User Interfaces with NUI',
    url: 'https://docs.fivem.net/docs/scripting-manual/nui-development/',
    snippets: {
      lua:
        "-- Buka UI\nSetNuiFocus(true, true)\n" +
        "SendNUIMessage({ action = 'openMenu' })\n\n" +
        "-- Terima callback dari NUI (JS di browser)\nRegisterNUICallback('closeMenu', function(data, cb)\n" +
        '  SetNuiFocus(false, false)\n' +
        '  cb({})\n' +
        'end)',
      csharp:
        '// Buka UI\n' +
        'SetNuiFocus(true, true);\n' +
        'SendNuiMessage(new { action = "openMenu" });\n\n' +
        '// Terima callback dari NUI\n' +
        'RegisterNuiCallbackType("closeMenu");\n' +
        'EventHandlers["__cfx_nui:closeMenu"] += new Action<IDictionary<string, object>, CallbackDelegate>((data, cb) =>\n' +
        '{\n' +
        '    SetNuiFocus(false, false);\n' +
        '    cb(new { });\n' +
        '});',
      js:
        "// Buka UI\nSetNuiFocus(true, true);\n" +
        "SendNuiMessage(JSON.stringify({ action: 'openMenu' }));\n\n" +
        "// Terima callback dari NUI (JS di browser)\nRegisterNuiCallbackType('closeMenu');\n" +
        "on('__cfx_nui:closeMenu', (data, cb) => {\n" +
        '  SetNuiFocus(false, false);\n' +
        '  cb({});\n' +
        '});',
    },
  },
};
