import * as XLSX from 'xlsx-js-style';
import { cleanDepartment, formatMinutes, TimesheetRecord } from './timesheetParser';

export interface TimesheetDayRow {
  work_date: string; // YYYY-MM-DD
  display_date: string; // DD/MM/YY
  day_of_week: string; // Hai, Ba, Tư, Năm, Sáu, Bảy, CN
  check_in_1: string;
  check_out_1: string;
  check_in_2: string;
  check_out_2: string;
  check_in_3: string;
  check_out_3: string;
  work_day: number; // Regular work day (if no violation)
  overtime_1: number; // Overtime hours
  leave_paid: number; // Nghỉ phép
  leave_holiday: number; // Nghỉ lễ
  violation_work_day: number; // Work day with late/early violation
  reason: string; // Lý do (Đi muộn, Xin về sớm, Quên CC, Đính bản cớ...)
  penalty: number; // Mức phạt (50000, 100000...)
  meal_allowance: number; // Hỗ trợ ăn tăng ca
  late_minutes: number;
  early_minutes: number;
  total_hours: number;
  is_sunday: boolean;
  is_green_row: boolean; // For Đính bản cớ, Quên CC, Xin nghỉ...
}

// Convert day index (0=Sun, 1=Mon, ..., 6=Sat) to Vietnamese short abbreviation
const getVietnameseDayOfWeek = (date: Date): string => {
  const day = date.getDay();
  switch (day) {
    case 0: return 'CN';
    case 1: return 'Hai';
    case 2: return 'Ba';
    case 3: return 'Tư';
    case 4: return 'Năm';
    case 5: return 'Sáu';
    case 6: return 'Bảy';
    default: return '';
  }
};

// Helper to parse HH:MM to minutes
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

// Process an employee's records to format daily rows with late/early calculation rules
export const processEmployeeDailyRows = (emp: any, targetMonthStr?: string): TimesheetDayRow[] => {
  const records: any[] = emp.records || [];
  const recordMap = new Map<string, any>();
  records.forEach(r => {
    const d = String(r.work_date || '').trim();
    if (d) {
      recordMap.set(d, r);
    }
  });

  const isSatSpecialEmp = isSaturdaySpecialEmployee(emp.employee_code, emp.employee_name);

  // Determine month and year
  let year = new Date().getFullYear();
  let month = new Date().getMonth() + 1;

  if (targetMonthStr && targetMonthStr.includes('-')) {
    const parts = targetMonthStr.split('-');
    year = parseInt(parts[0], 10) || year;
    month = parseInt(parts[1], 10) || month;
  } else if (records.length > 0 && records[0].work_date) {
    const firstDate = records[0].work_date;
    if (firstDate.includes('-')) {
      const parts = firstDate.split('-');
      year = parseInt(parts[0], 10) || year;
      month = parseInt(parts[1], 10) || month;
    }
  }

  const daysInMonth = new Date(year, month, 0).getDate();
  const result: TimesheetDayRow[] = [];

  let lateTier1Count = 0; // muộn 8h01 - 8h15 (1-15p): 5 lần đầu 50k, lần 6 100k, lần 7 150k (+50k)
  let lateTier2Count = 0; // muộn từ 8h16 trở đi (>15p): 5 lần đầu 100k, lần 6 200k, lần 7 300k (+100k)

  for (let day = 1; day <= daysInMonth; day++) {
    const dateObj = new Date(year, month - 1, day);
    const dayStr = String(day).padStart(2, '0');
    const monthStr = String(month).padStart(2, '0');
    const yearStr = String(year);
    const yearShort = yearStr.slice(-2);
    const dateKey = `${yearStr}-${monthStr}-${dayStr}`;
    const displayDate = `${dayStr}/${monthStr}/${yearShort}`;
    const dow = getVietnameseDayOfWeek(dateObj);
    const isSunday = dow === 'CN';
    const isSaturday = dow === 'Bảy';
    const isSatSpecial = isSaturday && isSatSpecialEmp;

    const existingRec = recordMap.get(dateKey);

    let check_in_1 = existingRec?.check_in_1 || '';
    let check_out_1 = existingRec?.check_out_1 || '';
    let check_in_2 = existingRec?.check_in_2 || '';
    let check_out_2 = existingRec?.check_out_2 || '';
    let check_in_3 = existingRec?.check_in_3 || '';
    let check_out_3 = existingRec?.check_out_3 || '';
    let rawReason = existingRec?.reason || existingRec?.note || '';
    let rawPenalty = existingRec?.penalty !== undefined ? Number(existingRec.penalty) : undefined;
    let rawMeal = Number(existingRec?.meal_allowance || 0);

    const inMins = parseTimeToMinutes(check_in_1);
    const outMins = parseTimeToMinutes(check_out_1);

    let late_minutes = 0;
    let early_minutes = 0;
    let total_hours = 0;
    let work_day = 0;
    let violation_work_day = 0;
    let overtime_1 = 0;
    let leave_paid = 0;
    let leave_holiday = 0;
    let reason = rawReason;
    let penalty = 0;
    let meal_allowance = rawMeal;
    let is_green_row = false;

    // Check reason for special highlights - ONLY Quên CC and Đính bản cớ get green highlight as in image
    const reasonLower = reason.toLowerCase();
    if (
      reasonLower.includes('đính bản cớ') ||
      reasonLower.includes('quên cc')
    ) {
      is_green_row = true;
    }

    if (isSunday) {
      work_day = 0;
      violation_work_day = 0;
    } else if (inMins === null && outMins === null) {
      // Absent or special reason
      if (reasonLower.includes('công tác') || reasonLower.includes('đính bản cớ')) {
        work_day = 1.0;
        if (reasonLower.includes('đính bản cớ')) {
          is_green_row = true;
        }
      } else if (reasonLower.includes('nghỉ phép') || reasonLower.includes('có giấy phép') || reasonLower.includes('online')) {
        leave_paid = 1.0;
        // Permitted leave does not highlight in green, keeps white background as in sample
      } else {
        work_day = 0;
      }
    } else {
      // Calculate late minutes (Standard start is 08:00 = 480 mins)
      if (inMins !== null && inMins > 480) {
        late_minutes = inMins - 480;
      }

      // Calculate early minutes (Standard end is 17:30 = 1050 mins)
      // For Saturday special employees (Hà Thị Kim Thanh 00001, Nguyễn Ngọc Quang 00072),
      // Saturday afternoon is off with full 1.0 work day, so early_minutes is 0.
      if (outMins !== null && outMins < 1050 && !isSatSpecial) {
        early_minutes = 1050 - outMins;
      }

      // Calculate total worked hours
      if (inMins !== null && outMins !== null && outMins > inMins) {
        const durationHours = (outMins - inMins) / 60;
        total_hours = Number(durationHours.toFixed(2));
        if (durationHours > 9.5) {
          overtime_1 = Number((durationHours - 9.5).toFixed(2));
        }
      }

      // Rule for Quên CC (Only Check-out or only Check-in)
      if (inMins === null && outMins !== null) {
        violation_work_day = 1.0;
        reason = reason || 'Quên CC vào lần 1';
        is_green_row = true;
      } else if (inMins !== null && outMins === null) {
        violation_work_day = 1.0;
        reason = reason || 'Quên CC ra';
        is_green_row = true;
      } else if (late_minutes > 0) {
        // Late calculation rule according to user requirements:
        // 1. If late <= 10 mins: work day = 1.00 (tròn 1 công) but moves to Vi Phạm column!
        // 2. If late > 10 mins: work day = (480 - late_minutes)/480 in Vi Phạm column!
        if (late_minutes <= 10) {
          violation_work_day = 1.00;
        } else {
          const calcWorkDay = Math.max(0, (480 - late_minutes) / 480);
          violation_work_day = Number(calcWorkDay.toFixed(2));
        }

        // Progressive penalty rule:
        // Tier 1 (8h01 - 8h15, tức <= 15p): 5 lần đầu 50k/lần, lần 6: 100k, lần 7: 150k, mỗi lần sau +50k
        // Tier 2 (từ 8h16 trở đi, tức > 15p): 5 lần đầu 100k/lần, lần 6: 200k, lần 7: 300k, mỗi lần sau +100k
        if (late_minutes <= 15) {
          lateTier1Count++;
          if (lateTier1Count <= 5) {
            penalty = 50000;
          } else {
            penalty = (lateTier1Count - 4) * 50000;
          }
        } else {
          lateTier2Count++;
          if (lateTier2Count <= 5) {
            penalty = 100000;
          } else {
            penalty = (lateTier2Count - 4) * 100000;
          }
        }

        reason = reason || 'Đi muộn';
      } else if (early_minutes > 0) {
        // User rule: "về sớm thì sẽ là có giấy phép hết đấy (không bị phạt)"
        reason = reason || 'Xin về sớm có giấy phép';
        penalty = 0; // Không bị phạt
        violation_work_day = 0; // Không tính vào vi phạm

        const workedMins = (outMins || 1050) - (inMins || 480) - 90; // trừ 1.5h ăn trưa
        work_day = Number(Math.max(0, workedMins / 480).toFixed(2)) || 0.56;
      } else {
        // Normal on-time working day
        if (isSatSpecial) {
          work_day = 1.0;
        } else if (outMins !== null && outMins >= 720 && outMins <= 810) {
          work_day = 0.5;
        } else {
          work_day = 1.0;
        }
      }
    }

    // Override penalty if raw penalty is explicitly given in file
    if (rawPenalty !== undefined && rawPenalty >= 0) {
      penalty = rawPenalty;
    }

    result.push({
      work_date: dateKey,
      display_date: displayDate,
      day_of_week: dow,
      check_in_1,
      check_out_1,
      check_in_2,
      check_out_2,
      check_in_3,
      check_out_3,
      work_day,
      overtime_1,
      leave_paid,
      leave_holiday,
      violation_work_day,
      reason,
      penalty,
      meal_allowance,
      late_minutes,
      early_minutes,
      total_hours,
      is_sunday: isSunday,
      is_green_row: is_green_row
    });
  }

  return result;
};

// Styling Constants for Excel Vouchers
const STYLES = {
  BORDER_THIN_ALL: {
    top: { style: 'thin', color: { rgb: '000000' } },
    bottom: { style: 'thin', color: { rgb: '000000' } },
    left: { style: 'thin', color: { rgb: '000000' } },
    right: { style: 'thin', color: { rgb: '000000' } }
  },
  BORDER_DOTTED_ROW: {
    top: { style: 'hair', color: { rgb: '000000' } },
    bottom: { style: 'hair', color: { rgb: '000000' } },
    left: { style: 'thin', color: { rgb: '000000' } },
    right: { style: 'thin', color: { rgb: '000000' } }
  },
  FILL_YELLOW: { fgColor: { rgb: 'FFFF00' } }, // Yellow #FFFF00 for Employee Header and Sunday rows
  FILL_GREEN: { fgColor: { rgb: '92D050' } }, // Bright Green #92D050 for Quên CC rows
  FILL_PINK_TOTAL: { fgColor: { rgb: 'F8CBAD' } }, // Warm Peach/Pink #F8CBAD for TỔNG CỘNG row
  FILL_HEADER_GRAY: { fgColor: { rgb: 'FFFFFF' } },
  FONT_TITLE: { name: 'Arial', sz: 11, bold: true, color: { rgb: '000000' } },
  FONT_HEADER: { name: 'Arial', sz: 10, bold: true, color: { rgb: '000000' } },
  FONT_REGULAR: { name: 'Arial', sz: 10, color: { rgb: '000000' } },
  FONT_BOLD: { name: 'Arial', sz: 10, bold: true, color: { rgb: '000000' } },
  FONT_ITALIC: { name: 'Arial', sz: 10, italic: true, color: { rgb: '000000' } },
};

// Add a cell with full styling, formula, and value
const setCell = (
  ws: any,
  col: number,
  row: number,
  cellData: {
    v?: any;
    f?: string;
    t?: 's' | 'n' | 'b' | 'd';
    z?: string;
    s?: any;
  }
) => {
  const cellRef = XLSX.utils.encode_cell({ c: col, r: row });
  const cell: any = {};

  if (cellData.f) {
    cell.f = cellData.f;
  }
  if (cellData.v !== undefined) {
    cell.v = cellData.v;
  }
  if (cellData.t) {
    cell.t = cellData.t;
  } else if (typeof cellData.v === 'number') {
    cell.t = 'n';
  } else {
    cell.t = 's';
  }
  if (cellData.z) {
    cell.z = cellData.z;
  }
  if (cellData.s) {
    cell.s = cellData.s;
  }

  ws[cellRef] = cell;
};

/**
 * Builds a single Employee Voucher block into the worksheet starting at `startRow`.
 * Returns the ending row index for chaining multiple employee blocks vertically.
 */
export const appendEmployeeVoucherBlock = (
  ws: any,
  merges: any[],
  emp: any,
  startRow: number,
  targetMonthStr?: string
): number => {
  const dailyRows = processEmployeeDailyRows(emp, targetMonthStr);

  const empCode = emp.employee_code || '00001';
  const empName = emp.employee_name || 'Nhân viên';
  const empDept = cleanDepartment(emp.department) || '-----';

  let r = startRow;

  // 1. Title Row: "BẢNG CHI TIẾT CHẤM CÔNG"
  setCell(ws, 0, r, {
    v: 'BẢNG CHI TIẾT CHẤM CÔNG',
    s: {
      font: STYLES.FONT_TITLE,
      alignment: { horizontal: 'center', vertical: 'center' }
    }
  });
  merges.push({ s: { r, c: 0 }, e: { r, c: 15 } });
  r++;

  // 2. Yellow Header Row: Mã nhân viên | Tên nhân viên | Bộ phận
  const yellowHeaderStyle = {
    fill: STYLES.FILL_YELLOW,
    font: STYLES.FONT_BOLD,
    border: STYLES.BORDER_THIN_ALL,
    alignment: { vertical: 'center' }
  };

  for (let c = 0; c <= 15; c++) {
    setCell(ws, c, r, { v: '', s: yellowHeaderStyle });
  }

  setCell(ws, 0, r, {
    v: `Mã nhân viên: ${empCode}`,
    s: { ...yellowHeaderStyle, alignment: { horizontal: 'left', vertical: 'center' } }
  });
  merges.push({ s: { r, c: 0 }, e: { r, c: 2 } });

  setCell(ws, 3, r, {
    v: `Tên nhân viên: ${empName}`,
    s: { ...yellowHeaderStyle, alignment: { horizontal: 'left', vertical: 'center' } }
  });
  merges.push({ s: { r, c: 3 }, e: { r, c: 6 } });

  setCell(ws, 7, r, {
    v: `Bộ phận: ${empDept}`,
    s: { ...yellowHeaderStyle, alignment: { horizontal: 'left', vertical: 'center' } }
  });
  merges.push({ s: { r, c: 7 }, e: { r, c: 15 } });
  r++;

  // 3. Summary Box (3 Rows: Row 1=Ngày thường, Row 2=Cuối tuần, Row 3=TỔNG)
  const boxBorder = STYLES.BORDER_THIN_ALL;
  const sumHeaderStyle = { font: STYLES.FONT_REGULAR, border: boxBorder, alignment: { vertical: 'center' } };
  const sumNumStyle = { font: STYLES.FONT_REGULAR, border: boxBorder, alignment: { horizontal: 'right', vertical: 'center' }, z: '0.00' };
  const boldSumNumStyle = { font: STYLES.FONT_BOLD, border: boxBorder, alignment: { horizontal: 'right', vertical: 'center' }, z: '0.00' };

  // Row A: Ngày thường
  const ngayThuongRowIdx = r;
  setCell(ws, 0, r, { v: 'Ngày thường', s: sumHeaderStyle });
  setCell(ws, 1, r, { v: 0, s: sumNumStyle, z: '0.00' }); // Formula will be connected below
  setCell(ws, 2, r, { v: 0, s: sumNumStyle, z: '0.00' });
  setCell(ws, 3, r, { v: '', s: sumHeaderStyle });
  setCell(ws, 4, r, { v: 'Tăng ca 1', s: sumHeaderStyle });
  setCell(ws, 5, r, { v: 0, s: sumNumStyle, z: '0.00' });
  setCell(ws, 6, r, { v: 'Đi trễ', s: sumHeaderStyle });
  setCell(ws, 7, r, { v: '', s: sumHeaderStyle });
  r++;

  // Row B: Cuối tuần
  const cuoiTuanRowIdx = r;
  setCell(ws, 0, r, { v: 'Cuối tuần', s: sumHeaderStyle });
  setCell(ws, 1, r, { v: 0, s: sumNumStyle, z: '0' });
  setCell(ws, 2, r, { v: 0, s: sumNumStyle, z: '0' });
  setCell(ws, 3, r, { v: '', s: sumHeaderStyle });
  setCell(ws, 4, r, { v: 'Tăng ca 2', s: sumHeaderStyle });
  setCell(ws, 5, r, { v: 0, s: sumNumStyle, z: '0' });
  setCell(ws, 6, r, { v: 'Số lần', s: sumHeaderStyle });
  setCell(ws, 7, r, { v: emp.late_count || 0, s: sumNumStyle, z: '0' });
  r++;

  // Row C: TỔNG
  const tongRowIdx = r;
  setCell(ws, 0, r, { v: 'TỔNG', s: { ...sumHeaderStyle, font: STYLES.FONT_BOLD } });
  setCell(ws, 1, r, {
    f: `B${ngayThuongRowIdx + 1}+B${cuoiTuanRowIdx + 1}`,
    v: emp.total_work_days || 0,
    s: boldSumNumStyle,
    z: '0.00'
  });
  setCell(ws, 2, r, {
    f: `C${ngayThuongRowIdx + 1}+C${cuoiTuanRowIdx + 1}`,
    v: emp.total_work_hours || 0,
    s: boldSumNumStyle,
    z: '0.00'
  });
  setCell(ws, 3, r, { v: '', s: sumHeaderStyle });
  setCell(ws, 4, r, { v: 'Tăng ca 3', s: sumHeaderStyle });
  setCell(ws, 5, r, { v: 0, s: sumNumStyle, z: '0' });
  setCell(ws, 6, r, { v: 'Số phút', s: sumHeaderStyle });
  setCell(ws, 7, r, { v: emp.late_minutes || 0, s: sumNumStyle, z: '0' });
  r++;

  // 4. "Các loại vắng" table
  setCell(ws, 1, r, {
    v: 'Các loại vắng',
    s: { font: STYLES.FONT_ITALIC, border: boxBorder, alignment: { horizontal: 'center' } }
  });
  merges.push({ s: { r, c: 1 }, e: { r, c: 8 } });
  for (let c = 2; c <= 8; c++) {
    setCell(ws, c, r, { v: '', s: { font: STYLES.FONT_ITALIC, border: boxBorder } });
  }
  r++;

  const vangHeaders = ['V', 'OM', 'TS', 'R', 'Ro', 'P', 'F', 'H'];
  vangHeaders.forEach((vh, idx) => {
    setCell(ws, 1 + idx, r, {
      v: vh,
      s: { font: STYLES.FONT_BOLD, border: boxBorder, alignment: { horizontal: 'center' } }
    });
  });
  r++;

  const vangValues = [emp.absent_count || 0, 0, 0, 0, 0, 0, 0, 0];
  vangValues.forEach((vv, idx) => {
    setCell(ws, 1 + idx, r, {
      v: vv,
      s: { font: STYLES.FONT_REGULAR, border: boxBorder, alignment: { horizontal: 'center' } }
    });
  });
  r++;

  // 5. "Chi tiết" Section Header
  setCell(ws, 7, r, {
    v: 'Chi tiết',
    s: { font: STYLES.FONT_ITALIC, alignment: { horizontal: 'center' } }
  });
  merges.push({ s: { r, c: 7 }, e: { r, c: 9 } });
  r++;

  // 6. Detail Table Header (2-row Header)
  const headerRow1 = r;
  const headerRow2 = r + 1;
  const thStyle = {
    font: STYLES.FONT_HEADER,
    border: STYLES.BORDER_THIN_ALL,
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true }
  };

  // Row 1
  setCell(ws, 0, headerRow1, { v: 'Ngày', s: thStyle });
  merges.push({ s: { r: headerRow1, c: 0 }, e: { r: headerRow2, c: 0 } });

  setCell(ws, 1, headerRow1, { v: 'Thứ', s: thStyle });
  merges.push({ s: { r: headerRow1, c: 1 }, e: { r: headerRow2, c: 1 } });

  setCell(ws, 2, headerRow1, { v: '1', s: thStyle });
  setCell(ws, 3, headerRow1, { v: '', s: thStyle });
  merges.push({ s: { r: headerRow1, c: 2 }, e: { r: headerRow1, c: 3 } });

  setCell(ws, 4, headerRow1, { v: '2', s: thStyle });
  setCell(ws, 5, headerRow1, { v: '', s: thStyle });
  merges.push({ s: { r: headerRow1, c: 4 }, e: { r: headerRow1, c: 5 } });

  setCell(ws, 6, headerRow1, { v: '3', s: thStyle });
  setCell(ws, 7, headerRow1, { v: '', s: thStyle });
  merges.push({ s: { r: headerRow1, c: 6 }, e: { r: headerRow1, c: 7 } });

  setCell(ws, 8, headerRow1, { v: 'Công', s: thStyle });
  merges.push({ s: { r: headerRow1, c: 8 }, e: { r: headerRow2, c: 8 } });

  setCell(ws, 9, headerRow1, { v: 'Giờ làm thêm', s: thStyle });
  merges.push({ s: { r: headerRow1, c: 9 }, e: { r: headerRow2, c: 9 } });

  setCell(ws, 10, headerRow1, { v: 'Nghỉ Phép', s: thStyle });
  merges.push({ s: { r: headerRow1, c: 10 }, e: { r: headerRow2, c: 10 } });

  setCell(ws, 11, headerRow1, { v: 'Nghỉ Lễ', s: thStyle });
  merges.push({ s: { r: headerRow1, c: 11 }, e: { r: headerRow2, c: 11 } });

  setCell(ws, 12, headerRow1, { v: 'Vi Phạm', s: thStyle });
  merges.push({ s: { r: headerRow1, c: 12 }, e: { r: headerRow2, c: 12 } });

  setCell(ws, 13, headerRow1, { v: 'Lý do', s: thStyle });
  merges.push({ s: { r: headerRow1, c: 13 }, e: { r: headerRow2, c: 13 } });

  setCell(ws, 14, headerRow1, { v: 'Mức phạt', s: thStyle });
  merges.push({ s: { r: headerRow1, c: 14 }, e: { r: headerRow2, c: 14 } });

  setCell(ws, 15, headerRow1, { v: 'Hỗ trợ ăn Tăng ca', s: thStyle });
  merges.push({ s: { r: headerRow1, c: 15 }, e: { r: headerRow2, c: 15 } });

  // Row 2 Subheaders
  setCell(ws, 2, headerRow2, { v: 'Vào', s: thStyle });
  setCell(ws, 3, headerRow2, { v: 'Ra', s: thStyle });
  setCell(ws, 4, headerRow2, { v: 'Vào', s: thStyle });
  setCell(ws, 5, headerRow2, { v: 'Ra', s: thStyle });
  setCell(ws, 6, headerRow2, { v: 'Vào', s: thStyle });
  setCell(ws, 7, headerRow2, { v: 'Ra', s: thStyle });

  // Fill remaining subheader borders
  [0, 1, 8, 9, 10, 11, 12, 13, 14, 15].forEach(c => {
    setCell(ws, c, headerRow2, { v: '', s: thStyle });
  });

  r = headerRow2 + 1;
  const firstDataRow = r + 1; // 1-indexed for Excel formulas

  // 7. Daily Records
  dailyRows.forEach(dayRow => {
    const excelRow = r + 1; // 1-based row index in Excel
    let rowFill: any = undefined;
    let rowBorder = STYLES.BORDER_DOTTED_ROW;

    if (dayRow.is_sunday) {
      rowFill = STYLES.FILL_YELLOW;
      rowBorder = STYLES.BORDER_THIN_ALL;
    } else if (dayRow.is_green_row) {
      rowFill = STYLES.FILL_GREEN;
      rowBorder = STYLES.BORDER_THIN_ALL;
    }

    // Italic font for all columns except Cột Công
    const baseItalicStyle = {
      font: STYLES.FONT_ITALIC,
      border: rowBorder,
      fill: rowFill,
      alignment: { vertical: 'center' }
    };
    const centerItalicStyle = { ...baseItalicStyle, alignment: { horizontal: 'center', vertical: 'center' } };
    const numItalicStyle = { ...baseItalicStyle, alignment: { horizontal: 'center', vertical: 'center' } };
    const moneyItalicStyle = { ...baseItalicStyle, alignment: { horizontal: 'right', vertical: 'center' } };
    const reasonItalicStyle = { ...baseItalicStyle, alignment: { horizontal: 'left', vertical: 'center' } };

    // Regular (straight) font ONLY for Cột Công
    const congRegularStyle = {
      font: STYLES.FONT_REGULAR,
      border: rowBorder,
      fill: rowFill,
      alignment: { horizontal: 'center', vertical: 'center' }
    };

    // Col 0 (A): Ngày (Italic)
    setCell(ws, 0, r, { v: dayRow.display_date, s: centerItalicStyle });

    // Col 1 (B): Thứ (Italic)
    setCell(ws, 1, r, { v: dayRow.day_of_week, s: centerItalicStyle });

    // Col 2 (C): Vào 1 (Italic)
    setCell(ws, 2, r, { v: dayRow.check_in_1 || '', s: centerItalicStyle });

    // Col 3 (D): Ra 1 (Italic)
    setCell(ws, 3, r, { v: dayRow.check_out_1 || '', s: centerItalicStyle });

    // Col 4 (E): Vào 2 (Italic)
    setCell(ws, 4, r, { v: dayRow.check_in_2 || '', s: centerItalicStyle });

    // Col 5 (F): Ra 2 (Italic)
    setCell(ws, 5, r, { v: dayRow.check_out_2 || '', s: centerItalicStyle });

    // Col 6 (G): Vào 3 (Italic)
    setCell(ws, 6, r, { v: dayRow.check_in_3 || '', s: centerItalicStyle });

    // Col 7 (H): Ra 3 (Italic)
    setCell(ws, 7, r, { v: dayRow.check_out_3 || '', s: centerItalicStyle });

    // Col 8 (I): Công (Regular straight font with Excel Formula)
    // Formula checks: Sunday -> 0, Absent -> check special reasons, Violation (late/early/forget CC) -> empty, Normal -> 1.0 (or 0.56 if permitted early)
    // For Saturday special employees (Hà Thị Kim Thanh 00001, Nguyễn Ngọc Quang 00072), Saturday afternoon off is full 1.0 công
    const isSatSpecial = isSaturdaySpecialEmployee(emp.employee_code, emp.employee_name);
    const congFormula = isSatSpecial
      ? `IF(B${excelRow}="CN",0,IF(AND(C${excelRow}="",D${excelRow}=""),IF(OR(ISNUMBER(SEARCH("công tác",N${excelRow})),ISNUMBER(SEARCH("bản cớ",N${excelRow}))),1,""),IF(B${excelRow}="Bảy",IF(OR(AND(C${excelRow}="",D${excelRow}<>""),AND(C${excelRow}<>"",D${excelRow}=""),IF(C${excelRow}="",FALSE,TIMEVALUE(C${excelRow})>TIME(8,0,0))),"",1),IF(OR(AND(C${excelRow}="",D${excelRow}<>""),AND(C${excelRow}<>"",D${excelRow}=""),IF(C${excelRow}="",FALSE,TIMEVALUE(C${excelRow})>TIME(8,0,0)),IF(D${excelRow}="",FALSE,AND(TIMEVALUE(D${excelRow})<TIME(17,30,0),NOT(ISNUMBER(SEARCH("phép",N${excelRow})))))),"",IF(ISNUMBER(SEARCH("về sớm",N${excelRow})),0.56,1)))))`
      : `IF(B${excelRow}="CN",0,IF(AND(C${excelRow}="",D${excelRow}=""),IF(OR(ISNUMBER(SEARCH("công tác",N${excelRow})),ISNUMBER(SEARCH("bản cớ",N${excelRow}))),1,""),IF(OR(AND(C${excelRow}="",D${excelRow}<>""),AND(C${excelRow}<>"",D${excelRow}=""),IF(C${excelRow}="",FALSE,TIMEVALUE(C${excelRow})>TIME(8,0,0)),IF(D${excelRow}="",FALSE,AND(TIMEVALUE(D${excelRow})<TIME(17,30,0),NOT(ISNUMBER(SEARCH("phép",N${excelRow})))))),"",IF(ISNUMBER(SEARCH("về sớm",N${excelRow})),0.56,1))))`;

    if (dayRow.is_sunday) {
      setCell(ws, 8, r, {
        f: congFormula,
        v: 0,
        s: congRegularStyle,
        z: '0'
      });
    } else if (dayRow.work_day > 0) {
      setCell(ws, 8, r, {
        f: congFormula,
        v: dayRow.work_day,
        s: congRegularStyle,
        z: dayRow.work_day === 1 ? '0' : '0.00'
      });
    } else {
      setCell(ws, 8, r, {
        f: congFormula,
        v: '',
        s: congRegularStyle
      });
    }

    // Col 9 (J): Giờ làm thêm (Italic with Formula)
    const otFormula = `IF(IF(D${excelRow}="",FALSE,TIMEVALUE(D${excelRow})>TIME(17,30,0)),ROUND((TIMEVALUE(D${excelRow})-TIME(17,30,0))*24,2),"")`;
    setCell(ws, 9, r, {
      f: dayRow.overtime_1 > 0 ? otFormula : undefined,
      v: dayRow.overtime_1 > 0 ? dayRow.overtime_1 : '',
      s: numItalicStyle,
      z: '0.00'
    });

    // Col 10 (K): Nghỉ Phép (Italic)
    setCell(ws, 10, r, {
      v: dayRow.leave_paid > 0 ? dayRow.leave_paid : '',
      s: numItalicStyle,
      z: '0.0'
    });

    // Col 11 (L): Nghỉ Lễ (Italic)
    setCell(ws, 11, r, {
      v: dayRow.leave_holiday > 0 ? dayRow.leave_holiday : '',
      s: numItalicStyle,
      z: '0.0'
    });

    // Col 12 (M): Vi Phạm (Italic with Excel Formula)
    // Formula checks:
    // - Quên CC: 1.0
    // - Đi muộn <= 10m: 1.0 (tròn 1 công)
    // - Đi muộn > 10m: (480 - late_minutes)/480
    // Về sớm có phép -> không đưa vào cột Vi Phạm
    const viPhamFormula = `IF(B${excelRow}="CN","",IF(OR(AND(C${excelRow}="",D${excelRow}<>""),AND(C${excelRow}<>"",D${excelRow}="")),1,IF(IF(C${excelRow}="",FALSE,TIMEVALUE(C${excelRow})>TIME(8,0,0)),IF(TIMEVALUE(C${excelRow})<=TIME(8,10,0),1,ROUND(MAX(0,(480-(TIMEVALUE(C${excelRow})-TIME(8,0,0))*1440)/480),2)),"")))`;

    if (dayRow.violation_work_day > 0) {
      setCell(ws, 12, r, {
        f: viPhamFormula,
        v: dayRow.violation_work_day,
        s: numItalicStyle,
        z: '0.00'
      });
    } else {
      setCell(ws, 12, r, {
        f: viPhamFormula,
        v: '',
        s: numItalicStyle
      });
    }

    // Col 13 (N): Lý do (Italic)
    setCell(ws, 13, r, { v: dayRow.reason || '', s: reasonItalicStyle });

    // Col 14 (O): Mức phạt (Italic with Excel Formula)
    // Formula Progressive Rules:
    // - Đi muộn 8h01 - 8h15: 5 lần đầu 50k, lần 6 100k, lần 7 150k (+50k)
    // - Đi muộn từ 8h16 trở đi: 5 lần đầu 100k, lần 6 200k, lần 7 300k (+100k)
    // - Về sớm có phép: Không phạt
    const phatFormula = `IF(B${excelRow}="CN","",IF(OR(ISNUMBER(SEARCH("quên",N${excelRow})),ISNUMBER(SEARCH("bản cớ",N${excelRow}))),"",IF(IF(C${excelRow}="",FALSE,TIMEVALUE(C${excelRow})>TIME(8,0,0)),IF(TIMEVALUE(C${excelRow})<=TIME(8,15,0),IF(COUNTIFS(C$${firstDataRow}:C${excelRow},">08:00",C$${firstDataRow}:C${excelRow},"<=08:15")<=5,50000,(COUNTIFS(C$${firstDataRow}:C${excelRow},">08:00",C$${firstDataRow}:C${excelRow},"<=08:15")-4)*50000),IF(COUNTIF(C$${firstDataRow}:C${excelRow},">08:15")<=5,100000,(COUNTIF(C$${firstDataRow}:C${excelRow},">08:15")-4)*100000)),"")))`;

    if (dayRow.penalty > 0) {
      setCell(ws, 14, r, {
        f: phatFormula,
        v: dayRow.penalty,
        s: moneyItalicStyle,
        z: '#,##0'
      });
    } else {
      setCell(ws, 14, r, {
        f: phatFormula,
        v: '',
        s: moneyItalicStyle
      });
    }

    // Col 15 (P): Hỗ trợ ăn Tăng ca (Italic)
    if (dayRow.meal_allowance > 0) {
      setCell(ws, 15, r, {
        v: dayRow.meal_allowance,
        s: moneyItalicStyle,
        z: '#,##0'
      });
    } else {
      setCell(ws, 15, r, { v: '', s: moneyItalicStyle });
    }

    r++;
  });

  const lastDataRow = r; // 1-indexed for Excel formulas
  const totalRowIdx = r;

  // 8. "TỔNG CỘNG" Row (Pink background, Bold, Formula calculations)
  const totalStyle = {
    font: STYLES.FONT_BOLD,
    fill: STYLES.FILL_PINK_TOTAL,
    border: STYLES.BORDER_THIN_ALL,
    alignment: { vertical: 'center' }
  };
  const totalCenterStyle = { ...totalStyle, alignment: { horizontal: 'center', vertical: 'center' } };
  const totalMoneyStyle = { ...totalStyle, alignment: { horizontal: 'right', vertical: 'center' } };

  // Merged A to H: "TỔNG CỘNG"
  for (let c = 0; c <= 7; c++) {
    setCell(ws, c, totalRowIdx, { v: '', s: totalCenterStyle });
  }
  setCell(ws, 0, totalRowIdx, {
    v: 'TỔNG CỘNG',
    s: { ...totalStyle, alignment: { horizontal: 'center', vertical: 'center' } }
  });
  merges.push({ s: { r: totalRowIdx, c: 0 }, e: { r: totalRowIdx, c: 7 } });

  // Calculate sum values for non-formula fallback
  const sumCong = dailyRows.reduce((sum, d) => sum + (d.work_day || 0), 0);
  const sumOT = dailyRows.reduce((sum, d) => sum + (d.overtime_1 || 0), 0);
  const sumPhep = dailyRows.reduce((sum, d) => sum + (d.leave_paid || 0), 0);
  const sumLe = dailyRows.reduce((sum, d) => sum + (d.leave_holiday || 0), 0);
  const sumViPham = dailyRows.reduce((sum, d) => sum + (d.violation_work_day || 0), 0);
  const sumPhat = dailyRows.reduce((sum, d) => sum + (d.penalty || 0), 0);
  const sumAn = dailyRows.reduce((sum, d) => sum + (d.meal_allowance || 0), 0);

  // Col 8 (I): SUM Công
  setCell(ws, 8, totalRowIdx, {
    f: `SUM(I${firstDataRow}:I${lastDataRow})`,
    v: Number(sumCong.toFixed(2)),
    s: totalCenterStyle,
    z: '0.00'
  });

  // Col 9 (J): SUM Giờ làm thêm
  setCell(ws, 9, totalRowIdx, {
    f: `SUM(J${firstDataRow}:J${lastDataRow})`,
    v: Number(sumOT.toFixed(2)),
    s: totalCenterStyle,
    z: '0.00'
  });

  // Col 10 (K): SUM Nghỉ Phép
  setCell(ws, 10, totalRowIdx, {
    f: `SUM(K${firstDataRow}:K${lastDataRow})`,
    v: Number(sumPhep.toFixed(1)),
    s: totalCenterStyle,
    z: '0.0'
  });

  // Col 11 (L): SUM Nghỉ Lễ
  setCell(ws, 11, totalRowIdx, {
    f: `SUM(L${firstDataRow}:L${lastDataRow})`,
    v: Number(sumLe.toFixed(1)),
    s: totalCenterStyle,
    z: '0.0'
  });

  // Col 12 (M): SUM Vi Phạm
  setCell(ws, 12, totalRowIdx, {
    f: `SUM(M${firstDataRow}:M${lastDataRow})`,
    v: Number(sumViPham.toFixed(2)),
    s: totalCenterStyle,
    z: '0.00'
  });

  // Col 13 (N): Lý do blank
  setCell(ws, 13, totalRowIdx, { v: '', s: totalStyle });

  // Col 14 (O): SUM Mức phạt
  setCell(ws, 14, totalRowIdx, {
    f: `SUM(O${firstDataRow}:O${lastDataRow})`,
    v: sumPhat,
    s: totalMoneyStyle,
    z: '#,##0'
  });

  // Col 15 (P): SUM Hỗ trợ ăn Tăng ca
  setCell(ws, 15, totalRowIdx, {
    f: `SUM(P${firstDataRow}:P${lastDataRow})`,
    v: sumAn,
    s: totalMoneyStyle,
    z: '#,##0'
  });

  // Connect Ngày thường header cell to the detail total
  const totalCongPlusViPham = Number((sumCong + sumViPham).toFixed(2));
  const totalRegularHours = Number((totalCongPlusViPham * 8).toFixed(1));
  setCell(ws, 1, ngayThuongRowIdx, {
    f: `I${totalRowIdx + 1}+M${totalRowIdx + 1}`,
    v: totalCongPlusViPham,
    s: boldSumNumStyle,
    z: '0.00'
  });
  setCell(ws, 2, ngayThuongRowIdx, {
    f: `B${ngayThuongRowIdx + 1}*8`,
    v: totalRegularHours,
    s: boldSumNumStyle,
    z: '0.00'
  });
  setCell(ws, 5, ngayThuongRowIdx, {
    f: `J${totalRowIdx + 1}`,
    v: Number(sumOT.toFixed(2)),
    s: sumNumStyle,
    z: '0.00'
  });
  setCell(ws, 7, cuoiTuanRowIdx, {
    f: `COUNTIF(N${firstDataRow}:N${lastDataRow},"*Đi muộn*")`,
    v: emp.late_count || 0,
    s: sumNumStyle,
    z: '0'
  });

  r++; // After total row

  // 9. Signature Block
  r++; // blank row
  setCell(ws, 6, r, {
    v: 'Kí tên',
    s: { font: STYLES.FONT_BOLD, alignment: { horizontal: 'center' } }
  });
  merges.push({ s: { r, c: 6 }, e: { r, c: 10 } });
  r++;

  setCell(ws, 6, r, {
    v: '________________________',
    s: { font: STYLES.FONT_BOLD, alignment: { horizontal: 'center' } }
  });
  merges.push({ s: { r, c: 6 }, e: { r, c: 10 } });
  r++;

  setCell(ws, 6, r, {
    v: empName,
    s: { font: STYLES.FONT_BOLD, alignment: { horizontal: 'center' } }
  });
  merges.push({ s: { r, c: 6 }, e: { r, c: 10 } });
  r += 3; // 3 blank rows before next employee block

  return r;
};

// Column widths for standard voucher sheet
export const VOUCHER_COL_WIDTHS = [
  { wch: 11 }, // Col 0: Ngày
  { wch: 6.5 }, // Col 1: Thứ
  { wch: 8 },  // Col 2: Vào 1
  { wch: 8 },  // Col 3: Ra 1
  { wch: 7 },  // Col 4: Vào 2
  { wch: 7 },  // Col 5: Ra 2
  { wch: 7 },  // Col 6: Vào 3
  { wch: 7 },  // Col 7: Ra 3
  { wch: 7.5 }, // Col 8: Công
  { wch: 12 }, // Col 9: Giờ làm thêm
  { wch: 8.5 }, // Col 10: Nghỉ Phép
  { wch: 8.5 }, // Col 11: Nghỉ Lễ
  { wch: 8.5 }, // Col 12: Vi Phạm
  { wch: 28 }, // Col 13: Lý do
  { wch: 13 }, // Col 14: Mức phạt
  { wch: 14 }  // Col 15: Hỗ trợ ăn Tăng ca
];

/**
 * 1. Export All Employee Vouchers in ONE combined Sheet (Identical to original .xml format, without TONG_HOP sheet)
 */
export const exportTimesheetVouchersCombined = (
  employeeSummaries: any[],
  selectedMonth?: string
) => {
  if (!employeeSummaries || employeeSummaries.length === 0) {
    throw new Error('Không có dữ liệu chấm công để xuất');
  }

  const wb = XLSX.utils.book_new();

  // Combined Vouchers Sheet
  const wsVouchers: any = {};
  const merges: any[] = [];
  let currentRow = 0;

  employeeSummaries.forEach(emp => {
    currentRow = appendEmployeeVoucherBlock(wsVouchers, merges, emp, currentRow, selectedMonth);
  });

  wsVouchers['!ref'] = XLSX.utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: Math.max(currentRow, 50), c: 15 }
  });
  wsVouchers['!merges'] = merges;
  wsVouchers['!cols'] = VOUCHER_COL_WIDTHS;

  XLSX.utils.book_append_sheet(wb, wsVouchers, 'Chi Tiet');

  const fileName = `Bang_Chi_Tiet_Cham_Cong_Dang_Phieu_${selectedMonth || 'TatCa'}.xlsx`;
  XLSX.writeFile(wb, fileName);
};

/**
 * 2. Export Employee Vouchers with each employee on their own sheet
 */
export const exportTimesheetVouchersMultiSheet = (
  employeeSummaries: any[],
  selectedMonth?: string
) => {
  if (!employeeSummaries || employeeSummaries.length === 0) {
    throw new Error('Không có dữ liệu chấm công để xuất');
  }

  const wb = XLSX.utils.book_new();
  const usedSheetNames = new Set<string>();

  employeeSummaries.forEach(emp => {
    const wsEmp: any = {};
    const merges: any[] = [];

    appendEmployeeVoucherBlock(wsEmp, merges, emp, 0, selectedMonth);

    wsEmp['!ref'] = XLSX.utils.encode_range({
      s: { r: 0, c: 0 },
      e: { r: 45, c: 15 }
    });
    wsEmp['!merges'] = merges;
    wsEmp['!cols'] = VOUCHER_COL_WIDTHS;

    let cleanName = `${emp.employee_code}_${emp.employee_name}`
      .replace(/[:\\/?*\[\]]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (cleanName.length > 28) {
      cleanName = cleanName.substring(0, 28);
    }
    let sheetName = cleanName || 'NV';
    let dupCounter = 1;
    while (usedSheetNames.has(sheetName)) {
      sheetName = `${cleanName}_${dupCounter}`;
      dupCounter++;
    }
    usedSheetNames.add(sheetName);

    XLSX.utils.book_append_sheet(wb, wsEmp, sheetName);
  });

  const fileName = `Bang_Chi_Tiet_Cham_Cong_Moi_NV_1_Sheet_${selectedMonth || 'TatCa'}.xlsx`;
  XLSX.writeFile(wb, fileName);
};

/**
 * 3. Export Single Employee Voucher
 */
export const exportSingleEmployeeVoucher = (
  emp: any,
  selectedMonth?: string
) => {
  if (!emp) {
    throw new Error('Không có dữ liệu nhân sự');
  }

  const wb = XLSX.utils.book_new();
  const wsEmp: any = {};
  const merges: any[] = [];

  appendEmployeeVoucherBlock(wsEmp, merges, emp, 0, selectedMonth);

  wsEmp['!ref'] = XLSX.utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: 45, c: 15 }
  });
  wsEmp['!merges'] = merges;
  wsEmp['!cols'] = VOUCHER_COL_WIDTHS;

  let sheetName = `Phieu_${emp.employee_code}`.substring(0, 30);
  XLSX.utils.book_append_sheet(wb, wsEmp, sheetName);

  const cleanName = (emp.employee_name || emp.employee_code).replace(/\s+/g, '_');
  const fileName = `Phieu_Cham_Cong_${emp.employee_code}_${cleanName}_${selectedMonth || 'ChiTiet'}.xlsx`;
  XLSX.writeFile(wb, fileName);
};
