/**
 * Sala 13 - Sistema de reservas del Instituto de Informática.
 * Backend para Google Apps Script.
 */

const SALA13 = Object.freeze({
  APP_NAME: 'Reservas Sala 13 IDEI',
  ROOM_NAME: 'Sala 13 - Instituto de Informática',
  CALENDAR_NAME: 'Sala 13 - IdeI',
  SHEET_NAME: 'Reservas',
  TIME_ZONE: 'America/Argentina/San_Juan',
  OPEN_HOUR: 8,
  CLOSE_HOUR: 21,
  SATURDAY_CLOSE_HOUR: 13,
  REMINDER_HOURS_BEFORE: 48,
  MAX_CAPACITY: 15,
  MAX_RESERVATION_DAYS: 31,
  MAX_RECURRING_RANGE_DAYS: 180,
  MAX_RESERVATION_OCCURRENCES: 80,
  MAX_QUERY_DAYS: 62,
  PROVINCIAL_CLOSED_DAYS: Object.freeze({
    '06-13': 'Día de la Fundación de San Juan',
    '09-11': 'Día del Maestro',
    '10-10': 'Día de la Universidad Nacional de San Juan'
  }),
  INSTITUTIONAL_CLOSED_DAYS: Object.freeze({
    '12-24': 'Asueto del 24 de diciembre',
    '12-31': 'Asueto del 31 de diciembre'
  }),
  TOURISM_CLOSED_DAYS: Object.freeze({
    // Resolución 164/2025 de la Jefatura de Gabinete: días no laborables turísticos 2026.
    '2026-03-23': 'Día no laborable con fines turísticos',
    '2026-07-10': 'Día no laborable con fines turísticos',
    '2026-12-07': 'Día no laborable con fines turísticos'
  }),
  NOTICE_ITEMS: Object.freeze([
    'Uso exclusivo como sala de reuniones.',
    'Capacidad máxima: 15 personas.',
    'Prohíbido el ingreso con comida y/o bebidas.',
    'No se puede cambiar la disposición de los escritorios.',
    'Luego de su uso, se debe gestionar la limpieza de la sala con el personal de Ordenanza.'
  ])
});

const HEADERS = Object.freeze([
  'Código', 'Fecha de solicitud', 'Inicio del período', 'Fin del período', 'Solicitante', 'Correo',
  'Tipo de dependencia', 'Gabinete / Área', 'Motivo', 'Asistentes',
  'Estado', 'IDs de eventos', 'Observaciones', 'Recordatorio 48 h enviado',
  'Hash de gestión', 'Vencimiento de gestión', 'Última acción del solicitante',
  'Modalidad de reserva', 'Días semanales', 'Inicio solicitado', 'Fin solicitado'
]);

function doGet(e) {
  ensureSetup_();
  const template = HtmlService.createTemplateFromFile('Index');
  const parameters = e && e.parameter ? e.parameter : {};
  const token = String(parameters.manage || '').trim();
  const action = String(parameters.action || '').trim().toLowerCase();
  template.reminderToken = /^[a-f0-9]{64}$/i.test(token) ? token : '';
  template.reminderAction = ['confirm', 'modify', 'cancel'].indexOf(action) !== -1 ? action : '';
  return template
    .evaluate()
    .setTitle(SALA13.APP_NAME)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * Ejecutar una sola vez desde el editor de Apps Script.
 * Crea el calendario y la planilla, y guarda sus IDs de forma segura.
 */
function configurarSala13() {
  const resources = ensureSetup_();
  const ownerEmail = Session.getEffectiveUser().getEmail();
  if (ownerEmail) {
    PropertiesService.getScriptProperties().setProperty('ADMIN_EMAIL', ownerEmail);
  }
  return {
    calendarName: resources.calendar.getName(),
    calendarId: resources.calendar.getId(),
    spreadsheetName: resources.spreadsheet.getName(),
    spreadsheetUrl: resources.spreadsheet.getUrl(),
    adminEmail: ownerEmail || 'No detectado; configure ADMIN_EMAIL manualmente.'
  };
}

/** Instala un único control horario para los recordatorios de las próximas 48 horas. */
function configurarRecordatoriosSala13() {
  ensureSetup_();
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (trigger.getHandlerFunction() === 'procesarRecordatoriosSala13') ScriptApp.deleteTrigger(trigger);
  });
  ScriptApp.newTrigger('procesarRecordatoriosSala13').timeBased().everyHours(1).create();
  return { ok: true, message: 'Recordatorios automáticos activados: revisión cada hora.' };
}

/** Permite cambiar el correo que recibe avisos de nuevas reservas. */
function establecerCorreoAdministrador(email) {
  const cleanEmail = clean_(email, 150).toLowerCase();
  if (!isValidEmail_(cleanEmail)) throw new Error('El correo indicado no es válido.');
  PropertiesService.getScriptProperties().setProperty('ADMIN_EMAIL', cleanEmail);
  return 'Correo administrador actualizado: ' + cleanEmail;
}

function getAppData(startIso, endIso) {
  const start = new Date(startIso);
  const end = new Date(endIso);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
    throw new Error('El período solicitado no es válido.');
  }
  if ((end.getTime() - start.getTime()) / 86400000 > SALA13.MAX_QUERY_DAYS) {
    throw new Error('La consulta no puede superar ' + SALA13.MAX_QUERY_DAYS + ' días.');
  }
  
  const { calendar, spreadsheet } = ensureSetup_();
  const eventStatuses = getEventStatusMap_(spreadsheet);
  const events = calendar.getEvents(start, end)
    .filter(function (event) { return eventStatuses[event.getId()] !== 'a confirmar'; })
    .map(function (event) { return calendarEventToPublic_(event, eventStatuses[event.getId()]); });
  const closedDays = getClosedDays_(start, end);
  const limitedDays = getLimitedDays_(start, end);

  return {
    config: {
      roomName: SALA13.ROOM_NAME,
      maxCapacity: SALA13.MAX_CAPACITY,
      openHour: SALA13.OPEN_HOUR,
      closeHour: SALA13.CLOSE_HOUR,
      saturdayCloseHour: SALA13.SATURDAY_CLOSE_HOUR,
      noticeItems: SALA13.NOTICE_ITEMS,
      timeZone: SALA13.TIME_ZONE
    },
    events: events,
    closedDays: closedDays,
    limitedDays: limitedDays
  };
}

/** Devuelve, en orden cronológico, todas las franjas futuras de la agenda institucional. */
function getFutureReservations() {
  const now = new Date();
  const institutionalHorizon = new Date('2100-01-01T00:00:00Z');
  const { calendar, spreadsheet } = ensureSetup_();
  const eventStatuses = getEventStatusMap_(spreadsheet);
  return calendar.getEvents(now, institutionalHorizon)
    .filter(function (event) { return event.getEndTime() > now; })
    .sort(function (a, b) { return a.getStartTime() - b.getStartTime(); })
    .map(function (event) { return calendarEventToPublic_(event, eventStatuses[event.getId()]); });
}

function calendarEventToPublic_(event, storedStatus) {
  const area = extractArea_(event.getDescription(), event.getTitle ? event.getTitle() : '');
  const normalizedStatus = String(storedStatus || 'confirmada').trim().toLowerCase();
  const pendingConfirmation = normalizedStatus === 'a confirmar';
  return {
    id: event.getId(),
    // La agenda pública prioriza el área y el horario. Nunca expone al solicitante.
    title: area || 'Área no especificada',
    start: event.getStartTime().toISOString(),
    end: event.getEndTime().toISOString(),
    color: '#155e75',
    textColor: '#ffffff',
    extendedProps: {
      area: area || 'Área no especificada',
      confirmationStatus: pendingConfirmation ? 'Reserva a confirmar' : 'Reserva confirmada',
      pendingConfirmation: pendingConfirmation
    }
  };
}

/** Relaciona cada evento con el estado administrativo de su reserva. */
function getEventStatusMap_(spreadsheet) {
  const sheet = spreadsheet.getSheetByName(SALA13.SHEET_NAME);
  const values = sheet.getDataRange().getValues();
  const statuses = {};
  for (let index = 1; index < values.length; index++) {
    const row = values[index];
    const status = String(row[10] || '').trim().toLowerCase();
    String(row[11] || '').split('|').map(function (id) { return id.trim(); }).filter(String)
      .forEach(function (id) { statuses[id] = status; });
  }
  return statuses;
}

/** Días sin reservas: fines de semana, feriados nacionales/turísticos y cierres de San Juan. */
function getClosedDays_(start, end) {
  const days = [];
  const cursor = localDate_(formatDate_(start, 'yyyy-MM-dd'), '12:00');
  const lastExclusive = localDate_(formatDate_(end, 'yyyy-MM-dd'), '12:00');
  while (cursor < lastExclusive) {
    const info = closedDayInfo_(cursor);
    if (info) days.push({ date: formatDate_(cursor, 'yyyy-MM-dd'), label: info.label, type: info.type });
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

/** Sábados parcialmente disponibles, salvo que además sean feriado. */
function getLimitedDays_(start, end) {
  const days = [];
  const cursor = localDate_(formatDate_(start, 'yyyy-MM-dd'), '12:00');
  const lastExclusive = localDate_(formatDate_(end, 'yyyy-MM-dd'), '12:00');
  while (cursor < lastExclusive) {
    if (cursor.getDay() === 6 && !closedDayInfo_(cursor)) {
      days.push({
        date: formatDate_(cursor, 'yyyy-MM-dd'),
        label: 'Sábado: disponible de 08:00 a 13:00',
        closeHour: SALA13.SATURDAY_CLOSE_HOUR
      });
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

function closedDayInfo_(date) {
  const iso = formatDate_(date, 'yyyy-MM-dd');
  const monthDay = iso.slice(5);
  const national = nationalHolidayMap_(Number(iso.slice(0, 4)))[iso];
  if (SALA13.PROVINCIAL_CLOSED_DAYS[monthDay]) {
    return { type: 'provincial', label: SALA13.PROVINCIAL_CLOSED_DAYS[monthDay] };
  }
  if (SALA13.INSTITUTIONAL_CLOSED_DAYS[monthDay]) {
    return { type: 'institutional', label: SALA13.INSTITUTIONAL_CLOSED_DAYS[monthDay] };
  }
  if (SALA13.TOURISM_CLOSED_DAYS[iso]) {
    return { type: 'tourism', label: SALA13.TOURISM_CLOSED_DAYS[iso] };
  }
  if (national) return { type: 'national', label: national };
  const weekday = date.getDay();
  if (weekday === 0) return { type: 'weekend', label: 'Domingo · No disponible' };
  return null;
}

function nationalHolidayMap_(year) {
  const map = {};
  function add(date, label) { map[formatDate_(date, 'yyyy-MM-dd')] = label; }
  [
    [1, 1, 'Año Nuevo'], [3, 24, 'Día Nacional de la Memoria por la Verdad y la Justicia'],
    [4, 2, 'Día del Veterano y de los Caídos en la Guerra de Malvinas'],
    [5, 1, 'Día del Trabajo'], [5, 25, 'Día de la Revolución de Mayo'],
    [6, 20, 'Paso a la Inmortalidad del General Manuel Belgrano'],
    [7, 9, 'Día de la Independencia'], [12, 8, 'Inmaculada Concepción de María'],
    [12, 25, 'Navidad']
  ].forEach(function (item) { add(localDate_(year + '-' + pad2_(item[0]) + '-' + pad2_(item[1]), '12:00'), item[2]); });
  const easter = easterSunday_(year);
  const carnivalMonday = new Date(easter); carnivalMonday.setDate(easter.getDate() - 48);
  const carnivalTuesday = new Date(easter); carnivalTuesday.setDate(easter.getDate() - 47);
  const goodFriday = new Date(easter); goodFriday.setDate(easter.getDate() - 2);
  add(carnivalMonday, 'Lunes de Carnaval');
  add(carnivalTuesday, 'Martes de Carnaval');
  add(goodFriday, 'Viernes Santo');
  [
    [6, 17, 'Paso a la Inmortalidad del General Martín Miguel de Güemes'],
    [8, 17, 'Paso a la Inmortalidad del General José de San Martín'],
    [10, 12, 'Día del Respeto a la Diversidad Cultural'],
    [11, 20, 'Día de la Soberanía Nacional']
  ].forEach(function (item) { add(transferableHoliday_(year, item[0], item[1]), item[2]); });
  return map;
}

function transferableHoliday_(year, month, day) {
  const date = localDate_(year + '-' + pad2_(month) + '-' + pad2_(day), '12:00');
  const weekday = date.getDay();
  if (weekday === 2) date.setDate(date.getDate() - 1);
  if (weekday === 3) date.setDate(date.getDate() - 2);
  if (weekday === 4) date.setDate(date.getDate() + 4);
  if (weekday === 5) date.setDate(date.getDate() + 3);
  return date;
}

function easterSunday_(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return localDate_(year + '-' + pad2_(month) + '-' + pad2_(day), '12:00');
}

function createReservation(input) {
  const data = normalizeReservation_(input || {});
  const schedule = validateReservation_(data);
  const slots = schedule.slots;
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  const createdEvents = [];
  let spreadsheet;
  try {
    const resources = ensureSetup_();
    const calendar = resources.calendar;
    spreadsheet = resources.spreadsheet;

    const conflicts = slots.filter(function (slot) {
      return calendar.getEvents(slot.start, slot.end).some(function (candidate) {
        return candidate.getStartTime() < slot.end && candidate.getEndTime() > slot.start;
      });
    });
    if (conflicts.length) {
      const dates = conflicts.map(function (slot) { return formatDate_(slot.start, 'dd/MM/yyyy'); });
      throw new Error('Lo sentimos, la Sala 13 para esta fecha se encuentra ocupada. Fechas con conflicto: ' + dates.join(', ') + '.');
    }

    const code = Utilities.getUuid().split('-')[0].toUpperCase();
    const description = buildEventDescription_(data, code);
    slots.forEach(function (slot) {
      createdEvents.push(calendar.createEvent(
        'Sala 13 — ' + data.area,
        slot.start,
        slot.end,
        { location: SALA13.ROOM_NAME, description: description }
      ));
    });

    const sheet = spreadsheet.getSheetByName(SALA13.SHEET_NAME);
    sheet.appendRow([
      code,
      new Date(),
      slots[0].start,
      slots[slots.length - 1].end,
      data.requester,
      data.email,
      data.dependencyType,
      data.area,
      data.reason,
      data.attendees,
      'Registrada',
      createdEvents.map(function (item) { return item.getId(); }).join(' | '),
      slots.length + (slots.length === 1 ? ' día reservado' : ' días reservados'),
      '', '', '', 'Reserva creada el ' + formatDate_(new Date(), 'dd/MM/yyyy HH:mm'),
      data.scheduleMode === 'weekly' ? 'Semanal' : 'Continua',
      data.scheduleMode === 'weekly' ? weekdayLabels_(data.weekdays).join(', ') : '',
      data.startDate, data.endDate
    ]);

    SpreadsheetApp.flush();
    sendConfirmation_(data, code, slots, schedule.skippedClosedDays);
    notifyAdmin_(data, code, slots, spreadsheet.getUrl(), schedule.skippedClosedDays);

    return {
      ok: true,
      code: code,
      message: reservationSummary_(slots, 'Reserva registrada', data, schedule.skippedClosedDays),
      skippedClosedDays: schedule.skippedClosedDays,
      notice: SALA13.NOTICE_ITEMS.join(' ')
    };
  } catch (error) {
    createdEvents.forEach(function (event) {
      try { event.deleteEvent(); } catch (rollbackError) { /* Registro manual si Calendar no permite revertir. */ }
    });
    throw new Error(error && error.message ? error.message : 'No se pudo registrar la reserva.');
  } finally {
    lock.releaseLock();
  }
}

/**
 * Recupera una reserva activa por código o nombre, validando además el correo.
 * La coincidencia de correo no prueba su titularidad; la cancelación exige además un código por correo.
 */
function getReservationForEdit(identifier, email) {
  const { spreadsheet } = ensureSetup_();
  const reservation = findReservation_(spreadsheet, identifier, email,
    ['registrada', 'confirmada', 'a confirmar', 'cancelación pendiente']);
  return {
    code: reservation.code,
    requester: reservation.requester,
    area: reservation.area,
    cancellationPending: reservation.rawRow[10] === 'Cancelación pendiente',
    startDate: reservation.requestedStartDate,
    endDate: reservation.requestedEndDate,
    startTime: formatDate_(reservation.start, 'HH:mm'),
    endTime: formatDate_(reservation.startDayEnd, 'HH:mm'),
    scheduleMode: reservation.scheduleMode,
    weekdays: reservation.weekdays
  };
}

/** Modifica exclusivamente el período y el horario de una reserva existente. */
function updateReservation(input) {
  const request = input || {};
  const identifier = clean_(request.code, 120);
  const email = clean_(request.email, 150).toLowerCase();
  if (!identifier || !isValidEmail_(email)) {
    throw new Error('Ingresá el código de reserva y el correo utilizado originalmente.');
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const resources = ensureSetup_();
    const reservation = findReservation_(resources.spreadsheet, identifier, email,
      ['registrada', 'confirmada', 'a confirmar']);
    return updateReservationRecord_(resources, reservation, request,
      'Modificada desde el sitio el ' + formatDate_(new Date(), 'dd/MM/yyyy HH:mm'));
  } finally {
    lock.releaseLock();
  }
}

/** Modifica una reserva desde el enlace seguro del recordatorio y la deja confirmada. */
function updateReservationFromReminder(input) {
  const request = input || {};
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const resources = ensureSetup_();
    const reservation = findReservationByReminderToken_(resources.spreadsheet, request.token);
    return updateReservationRecord_(resources, reservation, request,
      'Confirmada mediante modificación desde el recordatorio el ' + formatDate_(new Date(), 'dd/MM/yyyy HH:mm'));
  } finally {
    lock.releaseLock();
  }
}

function updateReservationRecord_(resources, reservation, request, actionNote) {
  const createdEvents = [];
  try {
    const calendar = resources.calendar;
    const spreadsheet = resources.spreadsheet;
    const data = {
      requester: reservation.requester,
      email: reservation.email,
      dependencyType: reservation.dependencyType,
      area: reservation.area,
      reason: reservation.reason,
      attendees: reservation.attendees,
      startDate: clean_(request.startDate, 10),
      endDate: clean_(request.endDate, 10),
      startTime: clean_(request.startTime, 5),
      endTime: clean_(request.endTime, 5),
      scheduleMode: clean_(request.scheduleMode, 20) || 'continuous',
      weekdays: normalizeWeekdays_(request.weekdays),
      acceptedRules: request.acceptedRules === true
    };
    const schedule = validateReservation_(data);
    const slots = schedule.slots;
    const oldEventIds = reservation.eventIds;
    const conflicts = slots.filter(function (slot) {
      return calendar.getEvents(slot.start, slot.end).some(function (candidate) {
        return oldEventIds.indexOf(candidate.getId()) === -1 &&
          candidate.getStartTime() < slot.end && candidate.getEndTime() > slot.start;
      });
    });
    if (conflicts.length) {
      const dates = conflicts.map(function (slot) { return formatDate_(slot.start, 'dd/MM/yyyy'); });
      throw new Error('Lo sentimos, la Sala 13 para esta fecha se encuentra ocupada. Fechas con conflicto: ' + dates.join(', ') + '.');
    }

    const description = buildEventDescription_(data, reservation.code);
    slots.forEach(function (slot) {
      createdEvents.push(calendar.createEvent(
        'Sala 13 — ' + data.area,
        slot.start,
        slot.end,
        { location: SALA13.ROOM_NAME, description: description }
      ));
    });

    const sheet = spreadsheet.getSheetByName(SALA13.SHEET_NAME);
    const priorNotes = clean_(reservation.notes, 500);
    const modificationNote = 'Modificada el ' + formatDate_(new Date(), 'dd/MM/yyyy HH:mm') +
      ' · ' + slots.length + (slots.length === 1 ? ' día reservado' : ' días reservados');
    const updatedRow = reservation.rawRow.slice();
    while (updatedRow.length < HEADERS.length) updatedRow.push('');
    updatedRow[2] = slots[0].start;
    updatedRow[3] = slots[slots.length - 1].end;
    updatedRow[6] = data.dependencyType;
    updatedRow[10] = 'Confirmada';
    updatedRow[11] = createdEvents.map(function (item) { return item.getId(); }).join(' | ');
    updatedRow[12] = priorNotes ? priorNotes + ' | ' + modificationNote : modificationNote;
    updatedRow[14] = '';
    updatedRow[15] = '';
    updatedRow[16] = actionNote;
    updatedRow[17] = data.scheduleMode === 'weekly' ? 'Semanal' : 'Continua';
    updatedRow[18] = data.scheduleMode === 'weekly' ? weekdayLabels_(data.weekdays).join(', ') : '';
    updatedRow[19] = data.startDate;
    updatedRow[20] = data.endDate;
    sheet.getRange(reservation.rowNumber, 1, 1, HEADERS.length).setValues([updatedRow]);
    SpreadsheetApp.flush();

    oldEventIds.forEach(function (eventId) {
      try {
        const oldEvent = calendar.getEventById(eventId);
        if (oldEvent) oldEvent.deleteEvent();
      } catch (cleanupError) {
        console.warn('No se pudo eliminar un evento anterior: ' + cleanupError.message);
      }
    });

    sendModificationConfirmation_(data, reservation.code, slots, schedule.skippedClosedDays);
    notifyModificationAdmin_(data, reservation.code, slots, spreadsheet.getUrl(), schedule.skippedClosedDays);
    return {
      ok: true,
      code: reservation.code,
      message: 'La reserva fue modificada correctamente. ' +
        reservationSummary_(slots, 'Reserva confirmada', data, schedule.skippedClosedDays),
      skippedClosedDays: schedule.skippedClosedDays
    };
  } catch (error) {
    createdEvents.forEach(function (event) {
      try { event.deleteEvent(); } catch (rollbackError) { /* Evitar ocultar el error principal. */ }
    });
    throw new Error(error && error.message ? error.message : 'No se pudo modificar la reserva.');
  }
}

/** Envía una verificación al correo GUARDADO; nunca devuelve el código al navegador. */
function requestCancellation(code, email) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const resources = ensureSetup_();
    const reservation = findReservation_(resources.spreadsheet, code, email,
      ['registrada', 'confirmada', 'a confirmar', 'cancelación pendiente']);
    if (reservation.code.toLowerCase() !== String(code).trim().toLowerCase()) throw new Error('Ingresá el código de reserva.');
    const cache = CacheService.getScriptCache();
    const key = 'sala13-cancel-rate-' + cancellationDigest_(reservation.code + '|' + reservation.email);
    const now = Date.now();
    let rate = JSON.parse(cache.get(key) || 'null');
    if (!rate || now - rate.since >= 3600000) rate = { since: now, count: 0, last: 0 };
    if (rate.count >= 5 || now - rate.last < 60000) {
      throw new Error('Esperá un minuto antes de pedir otro código. Máximo: 5 envíos por hora y reserva.');
    }
    const challengeId = Utilities.getUuid();
    const pin = Utilities.getUuid().replace(/-/g, '').slice(0, 8).toUpperCase();
    const challenge = {
      code: reservation.code, email: reservation.email,
      digest: cancellationDigest_(challengeId + '|' + pin),
      fingerprint: cancellationFingerprint_(reservation),
      expires: now + 600000, attempts: 0
    };
    rate.count++;
    rate.last = now;
    cache.put(key, JSON.stringify(rate), 3600);
    MailApp.sendEmail({
      to: reservation.email,
      subject: 'Verificación para cancelar la reserva ' + reservation.code + ' · Sala 13',
      body: 'Tu código de verificación es: ' + pin + '\n\n' +
        'Permite cancelar TODOS los días de la reserva ' + reservation.code + ', del ' +
        formatDate_(reservation.start, 'dd/MM/yyyy') + ' al ' + formatDate_(reservation.end, 'dd/MM/yyyy') +
        ', de ' + formatDate_(reservation.start, 'HH:mm') + ' a ' + formatDate_(reservation.end, 'HH:mm') + '.\n' +
        'Vence en 10 minutos. No lo compartas. Si no solicitaste la cancelación, ignorá este mensaje; tu reserva no se modifica.'
    });
    cache.put('sala13-cancel-' + challengeId, JSON.stringify(challenge), 600);
    return { challengeId: challengeId, message: 'Enviamos un código al correo de la reserva. Vence en 10 minutos; revisá también Spam.' };
  } finally { lock.releaseLock(); }
}

/** Cancela solamente tras verificar el correo y la confirmación explícita del solicitante. */
function cancelReservation(input) {
  const request = input || {};
  if (request.confirmed !== true) throw new Error('Confirmá que deseás cancelar todos los días de esta reserva.');
  const challengeId = String(request.challengeId || '');
  if (!/^[a-f0-9-]{36}$/i.test(challengeId)) throw new Error('Solicitá un nuevo código de verificación.');
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const cache = CacheService.getScriptCache();
    const key = 'sala13-cancel-' + challengeId;
    const challenge = JSON.parse(cache.get(key) || 'null');
    if (!challenge || challenge.expires <= Date.now()) throw new Error('El código venció o ya no está disponible. Solicitá uno nuevo.');
    if (challenge.attempts >= 5) throw new Error('Se agotaron los intentos. Solicitá un nuevo código.');
    const pin = String(request.pin || '').trim().toUpperCase();
    if (cancellationDigest_(challengeId + '|' + pin) !== challenge.digest) {
      challenge.attempts++;
      cache.put(key, JSON.stringify(challenge), Math.max(1, Math.ceil((challenge.expires - Date.now()) / 1000)));
      throw new Error('El código de verificación no es correcto.');
    }
    const resources = ensureSetup_();
    const reservation = findReservation_(resources.spreadsheet, challenge.code, challenge.email,
      ['registrada', 'confirmada', 'a confirmar', 'cancelación pendiente', 'cancelada']);
    if (cancellationFingerprint_(reservation) !== challenge.fingerprint) {
      throw new Error('La reserva cambió desde que solicitaste el código. Buscala nuevamente y pedí otro código.');
    }
    return cancelReservationRecord_(resources, reservation,
      'Cancelada por el solicitante (correo verificado) el ' + formatDate_(new Date(), 'dd/MM/yyyy HH:mm'));
  } finally { lock.releaseLock(); }
}

/** Cancela desde el enlace seguro del recordatorio, siempre con una confirmación final en pantalla. */
function cancelReservationFromReminder(input) {
  const request = input || {};
  if (request.confirmed !== true) throw new Error('Confirmá que deseás cancelar todos los días de esta reserva.');
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const resources = ensureSetup_();
    const reservation = findReservationByReminderToken_(resources.spreadsheet, request.token);
    return cancelReservationRecord_(resources, reservation,
      'Cancelada desde el enlace seguro del recordatorio el ' + formatDate_(new Date(), 'dd/MM/yyyy HH:mm'));
  } finally { lock.releaseLock(); }
}

function cancelReservationRecord_(resources, reservation, note) {
  const result = { ok: true, code: reservation.code, message: 'La reserva fue cancelada. Se liberaron todos sus horarios.' };
  if (reservation.rawRow[10] === 'Cancelada') return result;
  const sheet = resources.spreadsheet.getSheetByName(SALA13.SHEET_NAME);
  // Guardar la intención ANTES de borrar eventos permite reintentar ante fallos parciales.
  sheet.getRange(reservation.rowNumber, 11).setValue('Cancelación pendiente');
  SpreadsheetApp.flush();
  const failed = [];
  reservation.eventIds.forEach(function (id) {
    try {
      const event = resources.calendar.getEventById(id);
      if (event) event.deleteEvent(); // Un evento ya eliminado no impide reintentar.
    } catch (error) { failed.push(id); }
  });
  if (failed.length) {
    throw new Error('La cancelación quedó pendiente: no se pudieron liberar todos los horarios. Reintentá; si persiste, contactá a la administración.');
  }
  const updatedRow = reservation.rawRow.slice();
  while (updatedRow.length < HEADERS.length) updatedRow.push('');
  updatedRow[10] = 'Cancelada';
  updatedRow[12] = (reservation.notes ? reservation.notes + ' | ' : '') + note;
  updatedRow[14] = '';
  updatedRow[15] = '';
  updatedRow[16] = note;
  sheet.getRange(reservation.rowNumber, 1, 1, HEADERS.length).setValues([updatedRow]);
  SpreadsheetApp.flush();
  // Una falla de correo no debe revertir ni ocultar una cancelación completada.
  const body = 'Se canceló la reserva ' + reservation.code + ' de Sala 13, del ' +
    formatDate_(reservation.start, 'dd/MM/yyyy') + ' al ' + formatDate_(reservation.end, 'dd/MM/yyyy') +
    ', de ' + formatDate_(reservation.start, 'HH:mm') + ' a ' + formatDate_(reservation.startDayEnd, 'HH:mm') +
    '. Se liberaron sus horarios. El registro se conserva como Cancelada en la planilla.';
  const recipients = [reservation.email, PropertiesService.getScriptProperties().getProperty('ADMIN_EMAIL')]
    .filter(function (address, index, all) { return address && all.indexOf(address) === index; });
  recipients.forEach(function (address) {
    try { MailApp.sendEmail({ to: address, subject: 'Reserva cancelada · Sala 13 · ' + reservation.code, body: body }); }
    catch (error) { console.warn('No se pudo enviar un aviso de cancelación.'); }
  });
  return result;
}

function cancellationDigest_(text) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text, Utilities.Charset.UTF_8)
    .map(function (byte) { return ('0' + (byte & 255).toString(16)).slice(-2); }).join('');
}

function cancellationFingerprint_(reservation) {
  return cancellationDigest_([reservation.code, reservation.email, reservation.start.toISOString(),
    reservation.end.toISOString(), reservation.eventIds.join('|')].join('\n'));
}

/**
 * Se ejecuta cada hora. Al enviar el aviso, la reserva pasa a “A confirmar”.
 * Continúa bloqueando conflictos en Calendar, aunque Mes/Semana deja de mostrarla.
 */
function procesarRecordatoriosSala13() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const resources = ensureSetup_();
    // URL fija de la única implementación web activa de Sala 13.
    // Los enlaces de Confirmar / Modificar / Cancelar de los recordatorios
    // siempre apuntan a esta implementación.
    const webAppUrl = ScriptApp.getService().getUrl();
    const sheet = resources.spreadsheet.getSheetByName(SALA13.SHEET_NAME);
    const values = sheet.getDataRange().getValues();
    const now = new Date();
    const cutoff = new Date(now.getTime() + SALA13.REMINDER_HOURS_BEFORE * 3600000);
    let sent = 0;
    const failures = [];

    for (let index = 1; index < values.length; index++) {
      const row = values[index];
      const status = String(row[10] || '').trim().toLowerCase();
      const start = new Date(row[2]);
      const eligibleStatus = status === 'registrada' || status === 'confirmada';
      if (!eligibleStatus || row[13] || isNaN(start.getTime()) || start <= now || start > cutoff) continue;

      const reservation = reservationFromRow_(row, index + 1);
      const token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
      const links = reminderLinks_(webAppUrl, token);
      try {
        sendReminderEmail_(reservation, links);
        const updatedRow = row.slice();
        while (updatedRow.length < HEADERS.length) updatedRow.push('');
        updatedRow[10] = 'A confirmar';
        updatedRow[13] = now;
        updatedRow[14] = cancellationDigest_(token);
        updatedRow[15] = start;
        updatedRow[16] = 'Recordatorio 48 h enviado el ' + formatDate_(now, 'dd/MM/yyyy HH:mm');
        sheet.getRange(index + 1, 1, 1, HEADERS.length).setValues([updatedRow]);
        SpreadsheetApp.flush();
        sent++;
      } catch (error) {
        failures.push(reservation.code + ': ' + (error && error.message ? error.message : String(error)));
      }
    }
    if (failures.length) console.warn('Recordatorios no enviados: ' + failures.join(' | '));
    return { ok: failures.length === 0, sent: sent, failures: failures.length };
  } finally { lock.releaseLock(); }
}

function reminderLinks_(webAppUrl, token) {
  const separator = webAppUrl.indexOf('?') === -1 ? '?' : '&';
  const base = webAppUrl + separator + 'manage=' + encodeURIComponent(token) + '&action=';
  return { confirm: base + 'confirm', modify: base + 'modify', cancel: base + 'cancel' };
}

function sendReminderEmail_(reservation, links) {
  const plain = 'Faltan aproximadamente 48 horas para tu reserva de Sala 13.\n\n' +
    'Código: ' + reservation.code + '\n' +
    'Fecha: ' + formatDate_(reservation.start, 'dd/MM/yyyy') +
    (formatDate_(reservation.start, 'yyyy-MM-dd') === formatDate_(reservation.end, 'yyyy-MM-dd') ? '' :
      ' al ' + formatDate_(reservation.end, 'dd/MM/yyyy')) + '\n' +
    'Horario: ' + formatDate_(reservation.start, 'HH:mm') + ' a ' + formatDate_(reservation.startDayEnd, 'HH:mm') + '\n' +
    (reservation.scheduleMode === 'weekly' ? 'Días: ' + weekdayLabels_(reservation.weekdays).join(', ') + '\n' : '') +
    'Área / gabinete: ' + reservation.area + '\n\n' +
    'Confirmar: ' + links.confirm + '\nModificar: ' + links.modify + '\nCancelar: ' + links.cancel + '\n\n' +
    'Hasta que elijas una opción, figurará en la vista Lista como Reserva a confirmar y el horario continuará bloqueado.';
  MailApp.sendEmail({
    to: reservation.email,
    subject: 'Acción requerida · Confirmá tu reserva de Sala 13 · ' + formatDate_(reservation.start, 'dd/MM/yyyy'),
    body: plain,
    name: SALA13.APP_NAME,
    htmlBody: reminderEmailHtml_(reservation, links)
  });
}

function reminderEmailHtml_(reservation, links) {
  const period = formatDate_(reservation.start, 'yyyy-MM-dd') === formatDate_(reservation.end, 'yyyy-MM-dd') ?
    formatDate_(reservation.start, 'dd/MM/yyyy') :
    formatDate_(reservation.start, 'dd/MM/yyyy') + ' al ' + formatDate_(reservation.end, 'dd/MM/yyyy');
  function button(url, label, color) {
    return '<a href="' + html_(url) + '" style="display:block;margin:12px 0;padding:16px 18px;' +
      'border-radius:10px;background:' + color + ';color:#ffffff;text-decoration:none;text-align:center;' +
      'font-size:18px;font-weight:800">' + html_(label) + '</a>';
  }
  return '<div style="max-width:620px;margin:auto;padding:22px;font-family:Arial,sans-serif;color:#17324d;line-height:1.5">' +
    '<h1 style="margin:0 0 8px;color:#123b5d;font-size:27px">Confirmá tu reserva de Sala 13</h1>' +
    '<p style="font-size:16px">Faltan aproximadamente <b>48 horas</b>. Elegí qué querés hacer:</p>' +
    '<div style="background:#eef4f7;border-radius:12px;padding:16px;margin:18px 0">' +
    '<b>Código:</b> ' + html_(reservation.code) + '<br><b>Fecha:</b> ' + period +
    '<br><b>Horario:</b> ' + formatDate_(reservation.start, 'HH:mm') + ' a ' + formatDate_(reservation.startDayEnd, 'HH:mm') +
    (reservation.scheduleMode === 'weekly' ? '<br><b>Días semanales:</b> ' + html_(weekdayLabels_(reservation.weekdays).join(', ')) : '') +
    '<br><b>Área / gabinete:</b> ' + html_(reservation.area) + '</div>' +
    button(links.confirm, 'CONFIRMAR RESERVA', '#18794e') +
    button(links.modify, 'MODIFICAR RESERVA', '#123b5d') +
    button(links.cancel, 'CANCELAR RESERVA', '#a33a32') +
    '<p style="margin-top:18px;color:#536878;font-size:13px">Hasta que elijas una opción, la reserva aparecerá solamente en la vista Lista como <b>Reserva a confirmar</b>. El horario seguirá bloqueado para evitar superposiciones.</p>' +
    '</div>';
}

/** Devuelve únicamente los datos necesarios para la pantalla protegida del recordatorio. */
function getReminderReservation(token) {
  const { spreadsheet } = ensureSetup_();
  const reservation = findReservationByReminderToken_(spreadsheet, token);
  return {
    code: reservation.code,
    area: reservation.area,
    startDate: reservation.requestedStartDate,
    endDate: reservation.requestedEndDate,
    startTime: formatDate_(reservation.start, 'HH:mm'),
    endTime: formatDate_(reservation.startDayEnd, 'HH:mm'),
    scheduleMode: reservation.scheduleMode,
    weekdays: reservation.weekdays,
    status: 'Reserva a confirmar'
  };
}

function confirmReservationFromReminder(token) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const resources = ensureSetup_();
    const reservation = findReservationByReminderToken_(resources.spreadsheet, token);
    const updatedRow = reservation.rawRow.slice();
    while (updatedRow.length < HEADERS.length) updatedRow.push('');
    const note = 'Confirmada desde el recordatorio el ' + formatDate_(new Date(), 'dd/MM/yyyy HH:mm');
    updatedRow[10] = 'Confirmada';
    updatedRow[12] = (reservation.notes ? reservation.notes + ' | ' : '') + note;
    updatedRow[14] = '';
    updatedRow[15] = '';
    updatedRow[16] = note;
    resources.spreadsheet.getSheetByName(SALA13.SHEET_NAME)
      .getRange(reservation.rowNumber, 1, 1, HEADERS.length).setValues([updatedRow]);
    SpreadsheetApp.flush();
    return { ok: true, code: reservation.code, message: 'Reserva confirmada. Ya vuelve a mostrarse en el calendario.' };
  } finally { lock.releaseLock(); }
}

function findReservationByReminderToken_(spreadsheet, token) {
  const cleanToken = String(token || '').trim();
  if (!/^[a-f0-9]{64}$/i.test(cleanToken)) throw new Error('El enlace de gestión no es válido.');
  const digest = cancellationDigest_(cleanToken);
  const sheet = spreadsheet.getSheetByName(SALA13.SHEET_NAME);
  const values = sheet.getDataRange().getValues();
  for (let index = 1; index < values.length; index++) {
    const row = values[index];
    if (String(row[10] || '').trim().toLowerCase() !== 'a confirmar') continue;
    if (String(row[14] || '').trim() !== digest) continue;
    const expires = new Date(row[15]);
    if (isNaN(expires.getTime()) || expires <= new Date()) {
      throw new Error('El enlace de gestión venció. Usá el código y el correo desde el sitio para gestionar la reserva.');
    }
    return reservationFromRow_(row, index + 1);
  }
  throw new Error('El enlace ya fue utilizado o no corresponde a una reserva pendiente.');
}

function findReservation_(spreadsheet, identifier, email, allowedStatuses) {
  const key = clean_(identifier, 120);
  const cleanEmail = clean_(email, 150).toLowerCase();
  if (!key || !isValidEmail_(cleanEmail)) {
    throw new Error('Ingresá el nombre o código y el correo utilizado al reservar.');
  }

  const sheet = spreadsheet.getSheetByName(SALA13.SHEET_NAME);
  const values = sheet.getDataRange().getValues();
  const keyLower = key.toLowerCase();
  const matches = [];
  for (let index = 1; index < values.length; index++) {
    const row = values[index];
    const codeMatches = String(row[0] || '').toLowerCase() === keyLower;
    const nameMatches = String(row[4] || '').trim().toLowerCase() === keyLower;
    const emailMatches = String(row[5] || '').trim().toLowerCase() === cleanEmail;
    const active = (allowedStatuses || ['registrada', 'confirmada', 'a confirmar'])
      .indexOf(String(row[10] || '').trim().toLowerCase()) !== -1;
    if ((codeMatches || nameMatches) && emailMatches && active) {
      matches.push({ row: row, rowNumber: index + 1, codeMatches: codeMatches });
    }
  }
  if (!matches.length) {
    throw new Error('No encontramos una reserva activa con esos datos. Revisá el nombre o código y el correo.');
  }
  const exactCodeMatch = matches.find(function (item) { return item.codeMatches; });
  if (!exactCodeMatch && matches.length > 1) {
    throw new Error('Encontramos más de una reserva para ese nombre. Ingresá el código recibido por correo.');
  }

  const selected = exactCodeMatch || matches[0];
  return reservationFromRow_(selected.row, selected.rowNumber);
}

function reservationFromRow_(row, rowNumber) {
  const start = new Date(row[2]);
  const periodEnd = new Date(row[3]);
  const startDayEnd = localDate_(formatDate_(start, 'yyyy-MM-dd'), formatDate_(periodEnd, 'HH:mm'));
  const storedType = String(row[6] || '').trim();
  const normalizedType = ['Gabinete del IdeI', 'Área del IdeI'].indexOf(storedType) !== -1 ?
    'Área interna del IdeI' : storedType;
  const scheduleMode = String(row[17] || '').trim().toLowerCase() === 'semanal' ? 'weekly' : 'continuous';
  const weekdays = scheduleMode === 'weekly' ? parseStoredWeekdays_(row[18]) : [];
  return {
    rawRow: row,
    rowNumber: rowNumber,
    code: String(row[0] || '').trim(),
    requester: String(row[4] || '').trim(),
    email: String(row[5] || '').trim().toLowerCase(),
    dependencyType: normalizedType,
    area: String(row[7] || '').trim(),
    reason: String(row[8] || '').trim(),
    attendees: Number(row[9]),
    start: start,
    end: periodEnd,
    startDayEnd: startDayEnd,
    eventIds: String(row[11] || '').split('|').map(function (item) { return item.trim(); }).filter(String),
    notes: String(row[12] || ''),
    status: String(row[10] || '').trim(),
    reminderSentAt: row[13] ? new Date(row[13]) : null,
    reminderHash: String(row[14] || '').trim(),
    reminderExpiresAt: row[15] ? new Date(row[15]) : null,
    lastRequesterAction: String(row[16] || '').trim(),
    scheduleMode: scheduleMode,
    weekdays: weekdays,
    requestedStartDate: /^\d{4}-\d{2}-\d{2}$/.test(String(row[19] || '')) ? String(row[19]) : formatDate_(start, 'yyyy-MM-dd'),
    requestedEndDate: /^\d{4}-\d{2}-\d{2}$/.test(String(row[20] || '')) ? String(row[20]) : formatDate_(periodEnd, 'yyyy-MM-dd')
  };
}

function ensureSetup_() {
  const props = PropertiesService.getScriptProperties();
  let calendarId = props.getProperty('CALENDAR_ID');
  let spreadsheetId = props.getProperty('SPREADSHEET_ID');
  let calendar = calendarId ? CalendarApp.getCalendarById(calendarId) : null;
  let spreadsheet = null;

  if (spreadsheetId) {
    try { spreadsheet = SpreadsheetApp.openById(spreadsheetId); } catch (error) { spreadsheet = null; }
  }
  if (!calendar) {
    calendar = CalendarApp.createCalendar(SALA13.CALENDAR_NAME, {
      summary: 'Agenda institucional de uso de la Sala 13',
      timeZone: SALA13.TIME_ZONE
    });
    calendarId = calendar.getId();
    props.setProperty('CALENDAR_ID', calendarId);
  }
  if (!spreadsheet) {
    spreadsheet = SpreadsheetApp.create('Control de reservas - Sala 13');
    spreadsheetId = spreadsheet.getId();
    props.setProperty('SPREADSHEET_ID', spreadsheetId);
  }

  initializeSheet_(spreadsheet);
  return { calendar: calendar, spreadsheet: spreadsheet };
}

function initializeSheet_(spreadsheet) {
  let sheet = spreadsheet.getSheetByName(SALA13.SHEET_NAME);
  if (!sheet) {
    sheet = spreadsheet.getSheets()[0];
    sheet.setName(SALA13.SHEET_NAME);
  }
  if (sheet.getMaxColumns() < HEADERS.length) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), HEADERS.length - sheet.getMaxColumns());
  }
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, HEADERS.length)
      .setBackground('#123b5d')
      .setFontColor('#ffffff')
      .setFontWeight('bold');
    sheet.getRange('B:B').setNumberFormat('dd/mm/yyyy hh:mm');
    sheet.getRange('C:D').setNumberFormat('dd/mm/yyyy hh:mm');
    sheet.getRange('N:N').setNumberFormat('dd/mm/yyyy hh:mm');
    sheet.getRange('P:P').setNumberFormat('dd/mm/yyyy hh:mm');
    sheet.autoResizeColumns(1, HEADERS.length);
  } else {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.getRange('N:N').setNumberFormat('dd/mm/yyyy hh:mm');
    sheet.getRange('P:P').setNumberFormat('dd/mm/yyyy hh:mm');
  }
}

function normalizeReservation_(input) {
  return {
    requester: clean_(input.requester, 120),
    email: clean_(input.email, 150).toLowerCase(),
    dependencyType: clean_(input.dependencyType, 60),
    area: clean_(input.area, 120),
    reason: clean_(input.reason, 600),
    attendees: Number(input.attendees),
    startDate: clean_(input.startDate, 10),
    endDate: clean_(input.endDate, 10),
    startTime: clean_(input.startTime, 5),
    endTime: clean_(input.endTime, 5),
    scheduleMode: clean_(input.scheduleMode, 20) || 'continuous',
    weekdays: normalizeWeekdays_(input.weekdays),
    acceptedRules: input.acceptedRules === true
  };
}

function validateReservation_(data) {
  const required = ['requester', 'email', 'dependencyType', 'area', 'reason', 'startDate', 'endDate', 'startTime', 'endTime'];
  required.forEach(function (key) {
    if (!data[key]) throw new Error('Completá todos los campos obligatorios.');
  });
  if (!isValidEmail_(data.email)) throw new Error('Ingresá un correo electrónico válido.');
  if (['Área interna del IdeI', 'Área externa al IdeI'].indexOf(data.dependencyType) === -1) {
    throw new Error('Seleccioná una procedencia válida.');
  }
  if (!Number.isInteger(data.attendees) || data.attendees < 1 || data.attendees > SALA13.MAX_CAPACITY) {
    throw new Error('La cantidad de asistentes debe ser entre 1 y ' + SALA13.MAX_CAPACITY + '.');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(data.endDate) || !/^\d{2}:\d{2}$/.test(data.startTime) || !/^\d{2}:\d{2}$/.test(data.endTime)) {
    throw new Error('La fecha o los horarios no tienen un formato válido.');
  }
  if (!isValidIsoDate_(data.startDate) || !isValidIsoDate_(data.endDate)) {
    throw new Error('Ingresá fechas válidas para el período.');
  }
  if (data.endDate < data.startDate) throw new Error('La fecha final debe ser igual o posterior a la fecha inicial.');
  if (['continuous', 'weekly'].indexOf(data.scheduleMode) === -1) {
    throw new Error('Seleccioná una modalidad de reserva válida.');
  }
  if (data.scheduleMode === 'weekly' && !data.weekdays.length) {
    throw new Error('Seleccioná al menos un día de la semana para la reserva recurrente.');
  }
  const rangeDays = Math.round((localDate_(data.endDate, '12:00') - localDate_(data.startDate, '12:00')) / 86400000) + 1;
  if (data.scheduleMode === 'continuous' && rangeDays > SALA13.MAX_RESERVATION_DAYS) {
    throw new Error('El período continuo no puede superar ' + SALA13.MAX_RESERVATION_DAYS + ' días.');
  }
  if (data.scheduleMode === 'weekly' && rangeDays > SALA13.MAX_RECURRING_RANGE_DAYS) {
    throw new Error('La reserva semanal no puede abarcar más de ' + SALA13.MAX_RECURRING_RANGE_DAYS + ' días.');
  }
  const schedule = buildReservationSchedule_(data);
  const slots = schedule.slots;
  if (data.scheduleMode === 'continuous' && schedule.skippedClosedDays.length) {
    throw new Error('La Sala 13 no está disponible los domingos ni feriados. Fechas no disponibles: ' +
      schedule.skippedClosedDays.map(function (day) { return day.label; }).join(', ') + '.');
  }
  if (!slots.length) {
    throw new Error('No quedó ninguna fecha disponible dentro del período y los días semanales seleccionados.');
  }
  if (slots.length > SALA13.MAX_RESERVATION_OCCURRENCES) {
    throw new Error('Una misma solicitud no puede superar ' + SALA13.MAX_RESERVATION_OCCURRENCES + ' encuentros.');
  }
  const saturdayOutsideHours = slots.filter(function (slot) {
    if (slot.start.getDay() !== 6) return false;
    const saturdayClose = localDate_(formatDate_(slot.start, 'yyyy-MM-dd'), pad2_(SALA13.SATURDAY_CLOSE_HOUR) + ':00');
    return slot.start >= saturdayClose || slot.end > saturdayClose;
  });
  if (saturdayOutsideHours.length) {
    throw new Error('Los sábados la Sala 13 solo puede reservarse de 08:00 a 13:00. Fechas fuera del horario permitido: ' +
      saturdayOutsideHours.map(function (slot) { return formatDate_(slot.start, 'dd/MM/yyyy'); }).join(', ') + '.');
  }
  const start = slots[0].start;
  const end = slots[0].end;
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
    throw new Error('El horario de finalización debe ser posterior al de inicio.');
  }
  const firstSlotDate = formatDate_(start, 'yyyy-MM-dd');
  const earliest = localDate_(firstSlotDate, pad2_(SALA13.OPEN_HOUR) + ':00');
  const latest = localDate_(firstSlotDate, pad2_(SALA13.CLOSE_HOUR) + ':00');
  if (start < earliest || end > latest) {
    throw new Error('Las reservas se admiten de ' + pad2_(SALA13.OPEN_HOUR) + ':00 a ' + pad2_(SALA13.CLOSE_HOUR) + ':00.');
  }
  if (start.getTime() < Date.now() - 60000) throw new Error('No se puede reservar una fecha u horario pasado.');
  if (!data.acceptedRules) throw new Error('Para reservar, debés aceptar las condiciones de uso de la sala.');
  return schedule;
}

function localDate_(date, time) {
  return new Date(date + 'T' + time + ':00');
}

function isValidIsoDate_(value) {
  const date = localDate_(value, '12:00');
  return !isNaN(date.getTime()) && formatDate_(date, 'yyyy-MM-dd') === value;
}

function buildDailySlots_(startDate, endDate, startTime, endTime) {
  const slots = [];
  const cursor = localDate_(startDate, '12:00');
  const last = localDate_(endDate, '12:00');
  while (cursor <= last) {
    const date = formatDate_(cursor, 'yyyy-MM-dd');
    slots.push({ start: localDate_(date, startTime), end: localDate_(date, endTime) });
    cursor.setDate(cursor.getDate() + 1);
  }
  return slots;
}

function buildReservationSchedule_(data) {
  const candidates = buildDailySlots_(data.startDate, data.endDate, data.startTime, data.endTime);
  const slots = [];
  const skippedClosedDays = [];
  candidates.forEach(function (slot) {
    if (data.scheduleMode === 'weekly' && data.weekdays.indexOf(slot.start.getDay()) === -1) return;
    const info = closedDayInfo_(slot.start);
    if (info) {
      skippedClosedDays.push({
        date: formatDate_(slot.start, 'yyyy-MM-dd'),
        label: formatDate_(slot.start, 'dd/MM/yyyy') + ' (' + info.label + ')'
      });
      return;
    }
    slots.push(slot);
  });
  return { slots: slots, skippedClosedDays: skippedClosedDays };
}

function normalizeWeekdays_(values) {
  const source = Array.isArray(values) ? values : String(values || '').split(',');
  return source.map(function (value) { return Number(value); })
    .filter(function (value, index, all) {
      return Number.isInteger(value) && value >= 1 && value <= 6 && all.indexOf(value) === index;
    }).sort();
}

function weekdayLabels_(weekdays) {
  const labels = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  return normalizeWeekdays_(weekdays).map(function (day) { return labels[day]; });
}

function parseStoredWeekdays_(value) {
  const map = { lunes: 1, martes: 2, miercoles: 3, miércoles: 3, jueves: 4, viernes: 5, sabado: 6, sábado: 6 };
  return String(value || '').split(',').map(function (item) {
    return map[item.trim().toLowerCase()] || Number(item.trim());
  }).filter(function (day) { return Number.isInteger(day) && day >= 1 && day <= 6; }).sort();
}

function buildEventDescription_(data, code) {
  return [
    'Código: ' + code,
    'Solicitante: ' + data.requester,
    'Correo: ' + data.email,
    'Tipo: ' + data.dependencyType,
    'Área: ' + data.area,
    'Motivo: ' + data.reason,
    'Asistentes: ' + data.attendees,
    'Período: ' + data.startDate + ' al ' + data.endDate,
    'Modalidad: ' + (data.scheduleMode === 'weekly' ? 'Semanal' : 'Continua'),
    data.scheduleMode === 'weekly' ? 'Días: ' + weekdayLabels_(data.weekdays).join(', ') : '',
    '',
    SALA13.NOTICE_ITEMS.join('\n')
  ].join('\n');
}

function extractArea_(description, title) {
  const text = String(description || '');
  const match = text.match(/^(?:Área|Gabinete \/ Área):\s*(.+)$/mi);
  if (match) return clean_(match[1], 120);
  const titleMatch = String(title || '').match(/^Sala 13\s*[—-]\s*(.+)$/i);
  return titleMatch ? clean_(titleMatch[1], 120) : '';
}

function sendConfirmation_(data, code, slots, skippedClosedDays) {
  try {
    const start = slots[0].start;
    MailApp.sendEmail({
      to: data.email,
      subject: 'Reserva registrada · Sala 13 · ' + formatDate_(start, 'dd/MM/yyyy'),
      body: reservationSummary_(slots, 'Reserva registrada', data, skippedClosedDays) + ' Código: ' + code +
        '. Recibirás un correo para confirmarla aproximadamente 48 horas antes. ' + SALA13.NOTICE_ITEMS.join(' '),
      name: SALA13.APP_NAME,
      htmlBody: emailHtml_(data, code, slots, 'Reserva registrada · Sala 13', skippedClosedDays) +
        '<p style="font-family:Arial,sans-serif;color:#17324d"><b>Recibirás un recordatorio para confirmarla aproximadamente 48 horas antes.</b></p>'
    });
  } catch (error) {
    console.warn('La reserva se creó, pero no se pudo enviar la confirmación: ' + error.message);
  }
}

function notifyAdmin_(data, code, slots, sheetUrl, skippedClosedDays) {
  const admin = PropertiesService.getScriptProperties().getProperty('ADMIN_EMAIL');
  if (!admin || admin.toLowerCase() === data.email) return;
  try {
    MailApp.sendEmail({
      to: admin,
      subject: 'Nueva reserva Sala 13 · ' + data.area,
      body: 'Nueva reserva de ' + data.area + '. Código: ' + code + '.',
      name: SALA13.APP_NAME,
      htmlBody: emailHtml_(data, code, slots, '', skippedClosedDays) +
        '<p><a href="' + sheetUrl + '">Abrir registro administrativo</a></p>'
    });
  } catch (error) {
    console.warn('No se pudo enviar el aviso administrativo: ' + error.message);
  }
}

function sendModificationConfirmation_(data, code, slots, skippedClosedDays) {
  try {
    MailApp.sendEmail({
      to: data.email,
      subject: 'Reserva modificada · Sala 13 · ' + formatDate_(slots[0].start, 'dd/MM/yyyy'),
      body: 'La reserva ' + code + ' fue modificada. ' +
        reservationSummary_(slots, 'Reserva confirmada', data, skippedClosedDays),
      name: SALA13.APP_NAME,
      htmlBody: emailHtml_(data, code, slots, 'Reserva modificada · Sala 13', skippedClosedDays)
    });
  } catch (error) {
    console.warn('La reserva se modificó, pero no se pudo enviar la confirmación: ' + error.message);
  }
}

function notifyModificationAdmin_(data, code, slots, sheetUrl, skippedClosedDays) {
  const admin = PropertiesService.getScriptProperties().getProperty('ADMIN_EMAIL');
  if (!admin || admin.toLowerCase() === data.email) return;
  try {
    MailApp.sendEmail({
      to: admin,
      subject: 'Reserva modificada · Sala 13 · ' + data.area,
      body: 'Se modificó la reserva ' + code + ' de ' + data.area + '.',
      name: SALA13.APP_NAME,
      htmlBody: emailHtml_(data, code, slots, 'Reserva modificada · Sala 13', skippedClosedDays) +
        '<p><a href="' + sheetUrl + '">Abrir registro administrativo</a></p>'
    });
  } catch (error) {
    console.warn('No se pudo enviar el aviso administrativo de modificación: ' + error.message);
  }
}

function emailHtml_(data, code, slots, heading, skippedClosedDays) {
  const start = slots[0].start;
  const end = slots[slots.length - 1].end;
  const period = slots.length === 1 ? formatDate_(start, 'dd/MM/yyyy') :
    formatDate_(start, 'dd/MM/yyyy') + ' al ' + formatDate_(end, 'dd/MM/yyyy');
  return '<div style="font-family:Arial,sans-serif;color:#17324d;line-height:1.5">' +
    '<h2 style="color:#123b5d">' + html_(heading || 'Reserva confirmada · Sala 13') + '</h2>' +
    '<p><b>Código:</b> ' + html_(code) + '<br>' +
    '<b>Período:</b> ' + period + '<br>' +
    '<b>Modalidad:</b> ' + (data.scheduleMode === 'weekly' ?
      'Semanal · ' + html_(weekdayLabels_(data.weekdays).join(', ')) + ' · ' + slots.length + ' encuentros' : 'Período continuo') + '<br>' +
    '<b>Horario diario:</b> ' + formatDate_(start, 'HH:mm') + ' a ' + formatDate_(slots[0].end, 'HH:mm') + '<br>' +
    '<b>Solicitante:</b> ' + html_(data.requester) + '<br>' +
    '<b>Gabinete / Área:</b> ' + html_(data.area) + '<br>' +
    '<b>Motivo:</b> ' + html_(data.reason) + '<br>' +
    '<b>Asistentes:</b> ' + data.attendees + '</p>' +
    ((skippedClosedDays || []).length ? '<p style="background:#fff8e8;padding:10px 12px"><b>Fechas omitidas por feriados o asuetos:</b> ' +
      html_((skippedClosedDays || []).map(function (day) { return day.label; }).join(', ')) + '</p>' : '') +
    '<div style="background:#fff4e5;border-left:4px solid #f28c28;padding:12px 16px"><b>Condiciones de uso:</b><ul>' +
    SALA13.NOTICE_ITEMS.map(function (item) { return '<li><b>' + html_(item) + '</b></li>'; }).join('') + '</ul></div>' +
    '</div>';
}

function reservationSummary_(slots, label, data, skippedClosedDays) {
  const first = slots[0];
  const last = slots[slots.length - 1];
  const period = slots.length === 1 ? 'para el ' + formatDate_(first.start, 'dd/MM/yyyy') :
    'desde el ' + formatDate_(first.start, 'dd/MM/yyyy') + ' hasta el ' + formatDate_(last.start, 'dd/MM/yyyy');
  const recurrence = data && data.scheduleMode === 'weekly' ?
    slots.length + ' encuentros los ' + weekdayLabels_(data.weekdays).join(' y ') + ', ' : '';
  const skipped = (skippedClosedDays || []).length ?
    ' Se omitieron ' + skippedClosedDays.length + ' fechas por feriados o asuetos.' : '';
  return (label || 'Reserva confirmada') + ': ' + recurrence + period + ', de ' + formatDate_(first.start, 'HH:mm') +
    ' a ' + formatDate_(first.end, 'HH:mm') + '.' + skipped;
}

function clean_(value, maxLength) {
  return String(value == null ? '' : value).replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function html_(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function isValidEmail_(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function formatDate_(date, pattern) {
  return Utilities.formatDate(date, SALA13.TIME_ZONE, pattern);
}

function pad2_(number) {
  return String(number).padStart(2, '0');
}