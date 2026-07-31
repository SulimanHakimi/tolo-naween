'use client';

import { useEffect, useState } from 'react';
import { parseJDate, isoToJText, jLong } from '@/lib/format';

/**
 * Jalali date entry. The shop types `1404/06/28`; the parent receives an ISO
 * Gregorian `YYYY-MM-DD` string (or '' when the box is emptied) so the database
 * keeps storing real dates. Invalid text is flagged and never handed upward.
 */
export default function JDateField({ value, onChange, placeholder = '1404/06/28', allowEmpty = true, style }) {
  const [text, setText] = useState(() => isoToJText(value));
  const [bad, setBad] = useState(false);

  // Follow the parent when it resets the form (e.g. reopening the modal).
  useEffect(() => { setText(isoToJText(value)); setBad(false); }, [value]);

  function edit(e) {
    const next = e.target.value;
    setText(next);

    if (!next.trim()) {
      setBad(!allowEmpty);
      onChange('');
      return;
    }
    const iso = parseJDate(next);
    setBad(!iso);
    if (iso) onChange(iso);
  }

  const iso = parseJDate(text);

  return (
    <div style={style}>
      <input value={text} onChange={edit} placeholder={placeholder} inputMode="numeric"
        className={`field ltr${bad ? ' invalid' : ''}`} />
      <div style={{ fontSize: 11, marginTop: 4, color: bad ? 'var(--red)' : 'var(--faint)' }}>
        {bad ? 'تاریخ درست نیست — مثال: 1404/06/28' : iso ? jLong(iso) : 'تاریخ شمسی: سال/ماه/روز'}
      </div>
    </div>
  );
}
