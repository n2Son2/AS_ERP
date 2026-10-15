import * as XLSX from 'xlsx-js-style';

export interface TimesheetRecord {
  id?: string;
  employee_code: string;
  employee_name: string;
  department: string;
  work_date: string;
  day_of_week: string;
  check_in_1: string;
  check_out_1: string;
  check_in_2?: string;
  check_out_2?: string;
  check_in_3?: string;
  check_out_3?: string;
  late_minutes: number;
  early_minutes: number;
  work_day: number;
  violation_work_day?: number;
  total_hours: number;
  overtime_1: number;
  leave_paid?: number;
  leave_holiday?: number;
  reason?: string;
  penalty?: number;
  meal_allowance?: number;
  status: string;
  created_at?: string;
}

// Helper to convert HH:MM to minutes from midnight
const parseTimeToMinutes = (timeStr: string): number | null => {
  if (!timeStr) return null;
  const clean = timeStr.trim();
  const match = clean.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const hours = parseInt(match[1], 10);
  const mins = parseInt(match[2], 10);
  if (isNaN(hours) || isNaN(mins)) return null;
  return hours * 60 + mins;
};

// Helper to check if an employee has special exemption for Saturday afternoon (Hà Thị Kim Thanh 00001, Nguyễn Ngọc Quang 00072)
export const isSaturdaySpecialEmployee = (code?: string, name?: string): boolean => {
  const c = String(code || '').trim();
  const n = String(name || '').toLowerCase();
  if (
    c === '00001' ||
    c === '1' ||
    c.endsWith('00001') ||
    n.includes('hà thị kim thanh') ||
    n.includes('kim thanh')
  ) {
    return true;
  }
  if (
    c === '00072' ||
    c === '72' ||
    c.endsWith('00072') ||
    n.includes('nguyễn ngọc quang') ||
    n.includes('ngọc quang')
  ) {
    return true;
  }
  return false;
};

// Calculate metrics based on check-in and check-out
// Standard Check-in: 08:00 (480 mins)
// Standard Check-out: 17:30 (1050 mins)
export const calculateTimesheetMetrics = (
  checkInStr: string,
  checkOutStr: string,
  dayOfWeek: string,
  existingReason?: string,
  empCode?: string,
  empName?: string
) => {
  const inMins = parseTimeToMinutes(checkInStr);
  const outMins = parseTimeToMinutes(checkOutStr);

  let late_minutes = 0;
  let early_minutes = 0;
  let total_hours = 0;
  let work_day = 0;
  let violation_work_day = 0;
  let overtime_1 = 0;
  let penalty = 0;
  let reason = existingReason || '';

  const dowLower = (dayOfWeek || '').toLowerCase();
  const isSunday = dowLower === 'cn' || dowLower.includes('chủ nhật');
  const isSaturday = dowLower === 'bảy' || dowLower.includes('bảy') || dowLower.includes('thứ 7') || dowLower.includes('t7') || dowLower.includes('sat');
  const isSatSpecial = isSaturday && isSaturdaySpecialEmployee(empCode, empName);

  // Check In / Check Out logic
  if (inMins !== null) {
    // Standard in is 08:00 (480 mins)
    if (inMins > 480) {
      late_minutes = inMins - 480;
    }
  }

  if (outMins !== null) {
    // Standard out is 17:30 (1050 mins)
    // For Saturday special employees (Hà Thị Kim Thanh 00001, Nguyễn Ngọc Quang 00072),
    // Saturday afternoon is off with full 1.0 work day, so early_minutes is 0.
    if (outMins < 1050 && !isSatSpecial) {
      early_minutes = 1050 - outMins;
    }
  }

  if (inMins !== null && outMins !== null && outMins > inMins) {
    const durationInHours = (outMins - inMins) / 60;
    total_hours = Number(durationInHours.toFixed(2));

    if (isSatSpecial) {
      // Special Saturday employee gets full 1.0 cong on Saturday
      work_day = 1.0;
    } else {
      // Work day calculation rule:
      // 1. If check-out is between 12:00 (720 mins) and 13:30 / 1h30 PM (810 mins), count as 0.5 công
      // 2. If total worked hours >= 7.5 (including >= 9.5h and < 10h), count as 1.0 công
      if (outMins >= 720 && outMins <= 810) {
        work_day = 0.5;
      } else if (durationInHours >= 7.5) {
        work_day = 1.0;
      } else {
        work_day = Number((durationInHours / 7.5).toFixed(2));
      }
    }

    // Overtime rule: if worked > 9.5 hours
    if (durationInHours > 9.5) {
      overtime_1 = Number((durationInHours - 9.5).toFixed(2));
    }
  } else if (isSatSpecial && inMins !== null) {
    work_day = 1.0;
  }

  // Late calculation rules:
  // - If late <= 10 mins: work day = 1.00 (tròn 1 công) but moves to Vi Phạm column!
  // - If late > 10 mins: work day = (480 - late_minutes)/480 in Vi Phạm column!
  // - Penalty: 50.000 for <= 15 mins (tier 1 base), 100.000 for > 15 mins (tier 2 base)
  if (late_minutes > 0) {
    if (late_minutes <= 10) {
      violation_work_day = 1.00;
      penalty = 50000;
    } else {
      const calcWorkDay = Math.max(0, (480 - late_minutes) / 480);
      violation_work_day = Number(calcWorkDay.toFixed(2));
      penalty = late_minutes <= 15 ? 50000 : 100000;
    }
    work_day = 0; // Công shifts to Vi Phạm
    reason = reason || 'Đi muộn';
  } else if (early_minutes > 0) {
    // User rule: All early leaves are permitted with excuse -> no penalty, count in work_day
    reason = reason || 'Xin về sớm có giấy phép';
    penalty = 0;
    violation_work_day = 0;
    const workedMins = (outMins || 1050) - (inMins || 480) - 90;
    work_day = Number(Math.max(0, workedMins / 480).toFixed(2)) || 0.56;
  } else if (isSatSpecial && (inMins !== null || outMins !== null)) {
    // Full 1.0 cong on Saturday when on time
    work_day = 1.0;
  }

  // Quên chấm công (Missing In or Out)
  if (!isSunday) {
    if (inMins === null && outMins !== null) {
      violation_work_day = 1.0;
      work_day = 0;
      reason = reason || 'Quên CC vào lần 1';
    } else if (inMins !== null && outMins === null) {
      violation_work_day = 1.0;
      work_day = 0;
      reason = reason || 'Quên CC ra';
    }
  }

  // Determine status
  let status = 'Đúng giờ';
  if (isSunday) {
    status = 'Cuối tuần';
    work_day = 0;
    violation_work_day = 0;
  } else if (inMins === null && outMins === null) {
    status = 'Vắng mặt';
    work_day = 0;
    violation_work_day = 0;
    total_hours = 0;
  } else if (late_minutes > 0 && early_minutes > 0) {
    status = 'Đi trễ, về sớm';
  } else if (late_minutes > 0) {
    status = 'Đi trễ';
  } else if (early_minutes > 0) {
    status = 'Về sớm';
  }

  return {
    late_minutes,
    early_minutes,
    total_hours,
    work_day,
    violation_work_day,
    overtime_1,
    penalty,
    reason,
    status
  };
};

// Determine status based on timekeeping values
const getStatus = (dayOfWeek: string, checkIn: string, checkOut: string, late: number, early: number, workDay: number): string => {
  const dowLower = (dayOfWeek || '').toLowerCase();
  if (dowLower === 'cn' || dowLower.includes('chủ nhật')) {
    return 'Cuối tuần';
  }
  if (!checkIn && !checkOut && Number(workDay) === 0) {
    return 'Vắng mặt';
  }
  const lateNum = Number(late) || 0;
  const earlyNum = Number(early) || 0;
  if (lateNum > 0 && earlyNum > 0) return 'Đi trễ, về sớm';
  if (lateNum > 0) return 'Đi trễ';
  if (earlyNum > 0) return 'Về sớm';
  return 'Đúng giờ';
};

// Helper to format minutes duration (e.g., > 60 mins converted to hours and minutes)
export const formatMinutes = (mins: number | string | null | undefined): string => {
  const m = Number(mins) || 0;
  if (m <= 0) return '0p';
  if (m < 60) return `${m}p`;
  const hours = Math.floor(m / 60);
  const remainingMins = m % 60;
  if (remainingMins === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${remainingMins}p`;
};

// Helper to sanitize department names and replace &#45; or dashes with '-'
export const cleanDepartment = (dept: any): string => {
  if (dept === null || dept === undefined) return '-';
  let str = String(dept).trim();
  str = str
    .replace(/&#45;/gi, '-')
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
  
  const testClean = str.replace(/[\s\-]/g, '');
  if (!testClean || str.toLowerCase() === 'null' || str.toLowerCase() === 'undefined') {
    return '-';
  }
  return str;
};

// Format date string to YYYY-MM-DD
const formatDateStr = (rawVal: any): string => {
  if (!rawVal) return '';
  if (typeof rawVal === 'string') {
    // Check if ISO format YYYY-MM-DD
    if (rawVal.includes('T')) {
      return rawVal.split('T')[0];
    }
    // Check DD/MM/YYYY
    if (rawVal.includes('/')) {
      const parts = rawVal.split('/');
      if (parts.length === 3) {
        const d = parts[0].padStart(2, '0');
        const m = parts[1].padStart(2, '0');
        const y = parts[2].length === 2 ? '20' + parts[2] : parts[2];
        return `${y}-${m}-${d}`;
      }
    }
    if (rawVal.length >= 10 && rawVal.match(/^\d{4}-\d{2}-\d{2}/)) {
      return rawVal.substring(0, 10);
    }
  }
  if (rawVal instanceof Date) {
    const y = rawVal.getFullYear();
    const m = String(rawVal.getMonth() + 1).padStart(2, '0');
    const d = String(rawVal.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return String(rawVal);
};

// Extract employee details from string like: "Mã nhân viên: 00001   Tên nhân viên: Hà Thị Kim Thanh   Bộ phận: -----"
const extractEmployeeInfo = (text: string) => {
  let code = '';
  let name = '';
  let department = '';

  const codeMatch = text.match(/Mã nhân viên:\s*([^\s]+|\w+)/i) || text.match(/Mã NV:\s*([^\s]+|\w+)/i);
  if (codeMatch) code = codeMatch[1].trim();

  const nameMatch = text.match(/Tên nhân viên:\s*(.*?)(?=\s+Bộ phận:|$)/i) || text.match(/Tên NV:\s*(.*?)(?=\s+Bộ phận:|$)/i);
  if (nameMatch) name = nameMatch[1].trim();

  const deptMatch = text.match(/Bộ phận:\s*(.*)/i);
  if (deptMatch) department = cleanDepartment(deptMatch[1]);

  return { code, name, department };
};

// Custom parser for Excel 2003 XML timekeeping reports (e.g. Wise Eye, AttKey, Ronald Jack exports)
const parseXmlSpreadsheet = (xmlText: string): TimesheetRecord[] => {
  const records: TimesheetRecord[] = [];
  
  // Match all <Row> blocks
  const rowMatches = xmlText.match(/<Row[\s\S]*?<\/Row>/gi) || [];

  let currentEmp = { code: '', name: '', department: '' };

  for (const rowXml of rowMatches) {
    // Parse cells inside row
    const cellMatches = rowXml.match(/<Cell[\s\S]*?<\/Cell>/gi) || [];
    const rowData: Record<number, string> = {};

    let cellIndex = 0;
    for (const cellXml of cellMatches) {
      // Check ss:Index
      const indexMatch = cellXml.match(/ss:Index="(\d+)"/i);
      if (indexMatch) {
        cellIndex = parseInt(indexMatch[1], 10) - 1;
      }

      // Get Data value
      const dataMatch = cellXml.match(/<Data[\s\S]*?>([\s\S]*?)<\/Data>/i);
      if (dataMatch) {
        rowData[cellIndex] = dataMatch[1].trim();
      }

      cellIndex++;
    }

    const rowText = Object.values(rowData).join(' ');

    // Check if this row contains Employee header info
    if (rowText.includes('Mã nhân viên:') || rowText.includes('Tên nhân viên:')) {
      const emp = extractEmployeeInfo(rowText);
      if (emp.code || emp.name) {
        currentEmp = emp;
      }
      continue;
    }

    // Check if row is a date row (Cell 0 is a date string like 2026-07-01T00:00:00 or DD/MM/YYYY)
    const cell0 = rowData[0] || '';
    if (cell0.match(/^\d{4}-\d{2}-\d{2}/) || cell0.match(/^\d{1,2}\/\d{1,2}\/\d{4}/)) {
      const work_date = formatDateStr(cell0);
      const day_of_week = rowData[1] || '';
      const check_in_1 = rowData[2] || '';
      const check_out_1 = rowData[3] || '';
      const check_in_2 = rowData[4] || '';
      const check_out_2 = rowData[5] || '';
      const check_in_3 = rowData[6] || '';
      const check_out_3 = rowData[7] || '';
      const rawReason = rowData[13] || '';
      const rawPenalty = rowData[14] ? parseFloat(rowData[14].replace(/[^0-9.-]+/g, '')) : undefined;
      const rawMeal = rowData[15] ? parseFloat(rowData[15].replace(/[^0-9.-]+/g, '')) : 0;
      const leave_paid = rowData[10] ? parseFloat(rowData[10]) : 0;
      const leave_holiday = rowData[11] ? parseFloat(rowData[11]) : 0;

      // Auto-recalculate metrics strictly based on Check-In and Check-Out
      const metrics = calculateTimesheetMetrics(check_in_1, check_out_1, day_of_week, rawReason, currentEmp.code, currentEmp.name);

      if (currentEmp.code || currentEmp.name || work_date) {
        const empCode = currentEmp.code || 'NV001';
        const cleanEmpCode = empCode.replace(/[^a-zA-Z0-9]/g, '');
        records.push({
          id: `ts_${cleanEmpCode}_${work_date}`,
          employee_code: empCode,
          employee_name: currentEmp.name || 'Nhân viên',
          department: cleanDepartment(currentEmp.department),
          work_date,
          day_of_week,
          check_in_1,
          check_out_1,
          check_in_2,
          check_out_2,
          check_in_3,
          check_out_3,
          late_minutes: metrics.late_minutes,
          early_minutes: metrics.early_minutes,
          work_day: metrics.work_day,
          violation_work_day: metrics.violation_work_day,
          total_hours: metrics.total_hours,
          overtime_1: metrics.overtime_1,
          leave_paid,
          leave_holiday,
          reason: rawReason || metrics.reason,
          penalty: rawPenalty !== undefined ? rawPenalty : metrics.penalty,
          meal_allowance: rawMeal,
          status: metrics.status,
          created_at: new Date().toISOString()
        });
      }
    }
  }

  return records;
};

// Generic parser for ArrayBuffer / File using XLSX and fallback scanning
export const parseTimesheetFile = async (file: File): Promise<TimesheetRecord[]> => {
  const textContent = await file.text();

  // If file is XML Spreadsheet 2003
  if (textContent.includes('<Workbook') && textContent.includes('urn:schemas-microsoft-com:office:spreadsheet')) {
    const xmlRecords = parseXmlSpreadsheet(textContent);
    if (xmlRecords.length > 0) {
      return xmlRecords;
    }
  }

  // Fallback to XLSX library parsing
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
  
  const records: TimesheetRecord[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false });

    let currentEmp = { code: '', name: '', department: '' };

    for (let r = 0; r < rows.length; r++) {
      const row = rows[r] || [];
      const rowStr = row.map(c => String(c || '')).join(' ');

      // Check employee header
      if (rowStr.includes('Mã nhân viên:') || rowStr.includes('Mã NV:') || rowStr.includes('Tên nhân viên:')) {
        const emp = extractEmployeeInfo(rowStr);
        if (emp.code || emp.name) {
          currentEmp = emp;
        }
        continue;
      }

      // Check standard tabular header row if present
      const cell0 = String(row[0] || '').trim();
      const isDateCell = cell0.match(/^\d{4}-\d{2}-\d{2}/) || cell0.match(/^\d{1,2}\/\d{1,2}\/\d{4}/);

      if (isDateCell) {
        const work_date = formatDateStr(cell0);
        const day_of_week = String(row[1] || '').trim();
        const check_in_1 = String(row[2] || '').trim();
        const check_out_1 = String(row[3] || '').trim();
        const check_in_2 = String(row[4] || '').trim();
        const check_out_2 = String(row[5] || '').trim();
        const check_in_3 = String(row[6] || '').trim();
        const check_out_3 = String(row[7] || '').trim();
        const rawReason = String(row[13] || '').trim();
        const rawPenalty = row[14] ? parseFloat(String(row[14]).replace(/[^0-9.-]+/g, '')) : undefined;
        const rawMeal = row[15] ? parseFloat(String(row[15]).replace(/[^0-9.-]+/g, '')) : 0;
        const leave_paid = row[10] ? parseFloat(String(row[10])) : 0;
        const leave_holiday = row[11] ? parseFloat(String(row[11])) : 0;
        
        const metrics = calculateTimesheetMetrics(check_in_1, check_out_1, day_of_week, rawReason, currentEmp.code, currentEmp.name);
        const empCode = currentEmp.code || 'NV001';
        const cleanEmpCode = empCode.replace(/[^a-zA-Z0-9]/g, '');

        records.push({
          id: `ts_${cleanEmpCode}_${work_date}`,
          employee_code: empCode,
          employee_name: currentEmp.name || 'Nhân viên',
          department: cleanDepartment(currentEmp.department),
          work_date,
          day_of_week,
          check_in_1,
          check_out_1,
          check_in_2,
          check_out_2,
          check_in_3,
          check_out_3,
          late_minutes: metrics.late_minutes,
          early_minutes: metrics.early_minutes,
          work_day: metrics.work_day,
          violation_work_day: metrics.violation_work_day,
          total_hours: metrics.total_hours,
          overtime_1: metrics.overtime_1,
          leave_paid,
          leave_holiday,
          reason: rawReason || metrics.reason,
          penalty: rawPenalty !== undefined ? rawPenalty : metrics.penalty,
          meal_allowance: rawMeal,
          status: metrics.status,
          created_at: new Date().toISOString()
        });
      } else if (r > 0 && row.length >= 4) {
        // Tabular fallback if columns are [Mã NV, Tên NV, Ngày, Vào, Ra, ...]
        const colCode = String(row[0] || '').trim();
        const colName = String(row[1] || '').trim();
        const colDate = String(row[2] || '').trim();
        
        if (colCode && colDate && (colDate.match(/^\d{4}-\d{2}-\d{2}/) || colDate.match(/^\d{1,2}\/\d{1,2}\/\d{4}/))) {
          const work_date = formatDateStr(colDate);
          const check_in_1 = String(row[3] || '').trim();
          const check_out_1 = String(row[4] || '').trim();
          
          const metrics = calculateTimesheetMetrics(check_in_1, check_out_1, '');
          const cleanEmpCode = colCode.replace(/[^a-zA-Z0-9]/g, '');

          records.push({
            id: `ts_${cleanEmpCode}_${work_date}`,
            employee_code: colCode,
            employee_name: colName || 'Nhân viên',
            department: String(row[11] || 'Văn phòng'),
            work_date,
            day_of_week: '',
            check_in_1,
            check_out_1,
            late_minutes: metrics.late_minutes,
            early_minutes: metrics.early_minutes,
            work_day: metrics.work_day,
            total_hours: metrics.total_hours,
            overtime_1: metrics.overtime_1,
            status: metrics.status,
            created_at: new Date().toISOString()
          });
        }
      }
    }
  }

  return records;
};
