// ================================================================
// Shipt Analyzer — Google Apps Script (with Supabase Sync)
// ================================================================

var SHEET_NAME = 'Orders';
var HEADERS = [
  'Order ID','Claimed At','Store','Address','Region',
  'Base Pay ($)','Bonus ($)','Confirmed Tip ($)','Total Earned ($)',
  'Items','Est. Minutes','Distance (mi)','Score','Is Batch',
  'Run Status','Run Started','Run Ended','Shop Minutes'
];

function doGet(e) {
  try {
    if (!e.parameter || !e.parameter.d) {
      return respond({ status:'ok', message:'Shipt Analyzer connected!' });
    }
    var decoded = Utilities.newBlob(Utilities.base64Decode(e.parameter.d)).getDataAsString();
    var data = JSON.parse(decoded);
    if (data.action === 'syncAll') return handleSync(data.rows, data.chunk, data.total);
    return respond({ status:'error', message:'Unknown action' });
  } catch(err) {
    return respond({ status:'error', message:err.toString() });
  }
}

function handleSync(rows, chunkIndex, totalChunks) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);

  // A sheet trimmed to the old 14 columns cannot hold an 18-wide range, and
  // getRange would throw before anything is written.
  if (sheet.getMaxColumns() < HEADERS.length) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), HEADERS.length - sheet.getMaxColumns());
  }

  // Rewrites the header whenever it drifts, so sheets created with the
  // older 14-column layout pick up the shop-time columns automatically.
  var hRange = sheet.getRange(1, 1, 1, HEADERS.length);
  if (hRange.getValues()[0].join('|') !== HEADERS.join('|')) {
    hRange.setValues([HEADERS]);
    hRange.setBackground('#1a5c35');
    hRange.setFontColor('#ffffff');
    hRange.setFontWeight('bold');
  }

  if (rows && rows.length > 0) {
    var lastRow = sheet.getLastRow();
    var idToRow = {};
    if (lastRow > 1) {
      var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
      for (var i = 0; i < ids.length; i++) {
        var existingId = String(ids[i][0]).trim();
        if (existingId) idToRow[existingId] = i + 2;
      }
    }
    var nextRow = lastRow + 1;

    rows.forEach(function(r) {
      var row = padRow(r);
      sendToSupabase(row);

      var id = String(row[0]).trim();
      if (id && idToRow[id]) {
        sheet.getRange(idToRow[id], 1, 1, HEADERS.length).setValues([row]);
      } else {
        sheet.getRange(nextRow, 1, 1, HEADERS.length).setValues([row]);
        if (id) idToRow[id] = nextRow;
        nextRow++;
      }
    });
  }

  if (Number(chunkIndex) === Number(totalChunks) - 1) {
    var dataRows = sheet.getLastRow() - 1;
    if (dataRows > 1) {
      sheet.getRange(2, 1, dataRows, HEADERS.length).sort({ column: 2, ascending: false });
    }
    for (var c = 1; c <= HEADERS.length; c++) sheet.autoResizeColumn(c);
    var allRows = sheet.getLastRow() > 1
      ? sheet.getRange(2, 1, sheet.getLastRow() - 1, HEADERS.length).getValues()
      : [];
    buildSummary(ss, allRows);
  }
  return respond({ status:'ok', chunk:chunkIndex, written:rows ? rows.length : 0 });
}

// Guards against range-mismatch errors if an older client sends 14-column rows.
function padRow(r) {
  var row = (r || []).slice(0, HEADERS.length);
  while (row.length < HEADERS.length) row.push('');
  return row;
}

function toIsoOrNull(v) {
  if (!v && v !== 0) return null;
  var d = (v instanceof Date) ? v : new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

// ================================================================
// SEND DATA TO SUPABASE
// ================================================================
function sendToSupabase(row) {
  var props = PropertiesService.getScriptProperties();
  var SUPABASE_URL = props.getProperty('SUPABASE_URL');
  var SUPABASE_SERVICE_KEY = props.getProperty('SUPABASE_SERVICE_KEY');

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    Logger.log('Supabase properties not set in Project Settings > Script Properties. Skipping sync.');
    return;
  }

  // Everything below is inside the try: a single unparseable date must not
  // abort the whole sync loop and lose the remaining orders in the chunk.
  try {
    var claimedAt = toIsoOrNull(row[1]);
    if (!claimedAt) {
      Logger.log('Skipping order ' + row[0] + ': unparseable Claimed At value "' + row[1] + '"');
      return;
    }

    var shopMinutes = parseFloat(row[17]);

    var orderData = {
      order_id: row[0],
      claimed_at: claimedAt,
      store_name: row[2],
      address: row[3],
      region: row[4],
      base_pay: parseFloat(row[5]) || 0,
      bonus_pay: parseFloat(row[6]) || 0,
      confirmed_tip: (row[7] === 'pending' || row[7] === '') ? null : parseFloat(row[7]),
      item_count: parseInt(row[9]) || 0,
      estimated_minutes: parseInt(row[10]) || 0,
      distance_miles: parseFloat(row[11]) || 0,
      is_batch: row[13] === 'yes',
      run_status: row[14] || 'unstarted',
      run_started_at: toIsoOrNull(row[15]),
      run_ended_at: toIsoOrNull(row[16]),
      shop_minutes: isNaN(shopMinutes) ? null : shopMinutes
    };

    var options = {
      'method': 'POST',
      'contentType': 'application/json',
      'headers': {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_SERVICE_KEY
      },
      'payload': JSON.stringify(orderData),
      'muteHttpExceptions': true
    };

    var response = UrlFetchApp.fetch(SUPABASE_URL + '/functions/v1/add-order', options);
    Logger.log('Supabase response for order ' + orderData.order_id + ' (HTTP ' +
      response.getResponseCode() + '): ' + response.getContentText());
  } catch (e) {
    Logger.log('Error sending order ' + row[0] + ' to Supabase: ' + e.toString());
  }
}

function buildSummary(ss, rows) {
  var s = ss.getSheetByName('Summary') || ss.insertSheet('Summary');
  s.clearContents();
  var total=rows.length, base=0, tips=0, bonus=0, miles=0, mins=0, confirmed=0, batches=0;
  var shopMins=0, timedOrders=0;
  rows.forEach(function(r){
    base  += parseFloat(r[5])||0;
    bonus += parseFloat(r[6])||0;
    miles += parseFloat(r[11])||0;
    mins  += parseFloat(r[10])||0;
    if (r[13]==='yes') batches++;
    if (r[7]!=='pending'&&r[7]!==''){tips+=parseFloat(r[7])||0;confirmed++;}
    var sm = parseFloat(r[17]);
    if (!isNaN(sm) && sm > 0) { shopMins += sm; timedOrders++; }
  });
  var earned=base+tips+bonus, hourly=mins>0?earned/(mins/60):0;
  var actualHourly = shopMins>0 ? earned/(shopMins/60) : 0;
  var d=[
    ['SHIPT ANALYZER — SUMMARY',''],['Last synced',new Date().toLocaleString()],['',''],
    ['ORDERS',''],['Total claimed',total],['Tips confirmed',confirmed],['Tips pending',total-confirmed],['Batch orders',batches],
    ['',''],['EARNINGS',''],['Total earned','$'+earned.toFixed(2)],['Base pay','$'+base.toFixed(2)],
    ['Tips received','$'+tips.toFixed(2)],['Bonuses','$'+bonus.toFixed(2)],
    ['Avg per order','$'+(total>0?(earned/total).toFixed(2):'0.00')],
    ['$/hour (est.)','$'+hourly.toFixed(2)],['',''],['MILEAGE & TAX',''],
    ['Miles driven',miles.toFixed(1)+' mi'],
    ['Tax deduction (@$0.70/mi)','$'+(miles*0.70).toFixed(2)],
    ['',''],['SHOP TIME (ACTUAL)',''],
    ['Orders timed',timedOrders],
    ['Total shop time',(shopMins/60).toFixed(2)+' hrs'],
    ['$/hour (actual)',timedOrders>0?'$'+actualHourly.toFixed(2):'no timed runs yet']
  ];
  s.getRange(1,1,d.length,2).setValues(d);
  s.getRange(1,1).setFontWeight('bold').setFontSize(12).setFontColor('#1a5c35');
  [4,10,18,22].forEach(function(r){s.getRange(r,1).setFontWeight('bold');});
  s.autoResizeColumn(1); s.autoResizeColumn(2);
}

function respond(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// ================================================================
// ONE-TIME-USE IMPORTER FUNCTION
// ================================================================
function importHistoricalData() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    Logger.log('Could not find the "Orders" sheet.');
    return;
  }

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    Logger.log('No data rows to import.');
    return;
  }

  var dataRows = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();

  Logger.log('Starting import of ' + dataRows.length + ' rows to Supabase...');
  dataRows.forEach(function(row, index) {
    try {
      sendToSupabase(padRow(row));
      Logger.log('Row ' + (index + 1) + ': Successfully sent order ' + row[0]);
    } catch (e) {
      Logger.log('Row ' + (index + 1) + ': FAILED to send order ' + row[0] + '. Error: ' + e.toString());
    }
  });

  Logger.log('Historical data import complete.');
}
