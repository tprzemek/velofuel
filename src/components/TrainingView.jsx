import { useMemo, useState } from 'react';
import { Bike, Plus, CheckCircle2, RefreshCw } from 'lucide-react';
import { getIsoDate } from '../engine/defaultData';
import { computeDailyPlan, INTENSITY_OPTIONS } from '../engine/fuelingEngine';

function formatShortDay(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return {
    dow: dt.toLocaleDateString('en-US', { weekday: 'short' }),
    dayNum: d,
    isToday: iso === getIsoDate(0),
  };
}

export default function TrainingView({
  selectedDate,
  onSelectDate,
  sessions,
  profile,
  biometricsSummary,
  onSaveSession,
  onNavigateTab,
}) {
  const [editingDate, setEditingDate] = useState(null);
  const [form, setForm] = useState({
    title: '',
    intensity: 'endurance',
    durationMin: 90,
    plannedKj: 1000,
    actualKj: 0,
    timing: 'evening',
    status: 'planned',
  });

  const sessionByDate = useMemo(() => {
    const map = new Map();
    sessions.forEach((s) => map.set(s.date, s));
    return map;
  }, [sessions]);

  const weekDates = useMemo(() => [-1, 0, 1, 2, 3, 4, 5].map((off) => getIsoDate(off)), []);

  const weekPlans = useMemo(() => {
    return weekDates.map((d, idx) => {
      const prevDate = idx > 0 ? weekDates[idx - 1] : getIsoDate(-2);
      const nextDate = idx < weekDates.length - 1 ? weekDates[idx + 1] : getIsoDate(6);
      const sess = sessionByDate.get(d);
      const plan = computeDailyPlan({
        date: d,
        profile,
        biometricsSummary,
        todaySession: sess,
        tomorrowSession: sessionByDate.get(nextDate),
        yesterdaySession: sessionByDate.get(prevDate),
      });
      return { date: d, session: sess, plan };
    });
  }, [weekDates, sessionByDate, profile, biometricsSummary]);

  const weeklyDeficitTotal = weekPlans.reduce((sum, item) => sum + item.plan.plannedDeficit, 0);
  const weeklyCarbsTotal = weekPlans.reduce((sum, item) => sum + item.plan.targets.carbs, 0);
  const weeklyKjTotal = weekPlans.reduce((sum, item) => sum + item.plan.exerciseKj, 0);

  const openEditor = (iso, existing) => {
    setEditingDate(iso);
    setForm({
      title: existing?.title || 'Zone 2 Endurance Ride',
      intensity: existing?.intensity || 'endurance',
      durationMin: existing?.durationMin ?? 90,
      plannedKj: existing?.plannedKj ?? 980,
      actualKj: existing?.actualKj ?? 0,
      timing: existing?.timing || 'evening',
      status: existing?.status || 'planned',
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!editingDate) return;
    onSaveSession({
      id: `sess-${editingDate}`,
      date: editingDate,
      title: form.intensity === 'rest' ? 'Rest & Recovery Day' : form.title.trim() || 'Cycling Session',
      sport: form.intensity === 'rest' ? 'Rest' : 'Ride',
      intensity: form.intensity,
      durationMin: form.intensity === 'rest' ? 0 : Number(form.durationMin) || 0,
      plannedKj: form.intensity === 'rest' ? 0 : Number(form.plannedKj) || 0,
      actualKj: form.status === 'completed' ? Number(form.actualKj || form.plannedKj) || 0 : 0,
      timing: form.timing,
      status: form.status,
      source: 'manual',
    });
    setEditingDate(null);
  };

  return (
    <>
      <section className="card">
        <div className="section-header">
          <div>
            <h1 className="section-title" style={{ fontSize: '1.08rem' }}>7-Day Periodized Fuel Wave</h1>
            <p className="muted-text" style={{ marginTop: 3 }}>
              Carbs and calories rise on Threshold/Long rides and create your fat-loss deficit on Rest & Easy days.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-sm btn-soft"
            onClick={() => onNavigateTab('sync')}
            title="Sync from Intervals.icu"
          >
            <RefreshCw size={13} /> Sync
          </button>
        </div>

        <div className="on-bike-grid" style={{ marginTop: 8, paddingTop: 10 }}>
          <div className="mini-stat">
            <div className="mini-stat-label">7d Ride Work</div>
            <div className="mini-stat-val mono">{weeklyKjTotal.toLocaleString()} kJ</div>
          </div>
          <div className="mini-stat">
            <div className="mini-stat-label">7d Carbs</div>
            <div className="mini-stat-val mono" style={{ color: 'var(--code-high)' }}>
              {weeklyCarbsTotal.toLocaleString()} g
            </div>
          </div>
          <div className="mini-stat">
            <div className="mini-stat-label">7d Net Deficit</div>
            <div className="mini-stat-val mono">
              {weeklyDeficitTotal > 0 ? `-${weeklyDeficitTotal}` : `+${Math.abs(weeklyDeficitTotal)}`}
            </div>
          </div>
        </div>
      </section>

      <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {weekPlans.map(({ date, session, plan }) => {
          const info = formatShortDay(date);
          const isSelected = date === selectedDate;
          return (
            <div
              key={date}
              className={`week-row ${isSelected ? 'selected' : ''}`}
              onClick={() => {
                onSelectDate(date);
                onNavigateTab('today');
              }}
            >
              <div className="week-row-left">
                <div className="day-pill" style={info.isToday ? { borderColor: 'var(--code-high)', background: 'var(--code-high-bg)' } : undefined}>
                  <div className="day-pill-dow">{info.isToday ? 'TDY' : info.dow}</div>
                  <div className="day-pill-num mono">{info.dayNum}</div>
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: '0.86rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {session?.title || 'Rest Day'}
                  </div>
                  <div className="mono" style={{ fontSize: '0.72rem', color: 'var(--ink-secondary)', marginTop: 2 }}>
                    {plan.exerciseKj > 0 ? `${session.durationMin}m · ${plan.exerciseKj} kJ` : 'Rest'}
                    {session?.status === 'completed' && (
                      <CheckCircle2 size={11} style={{ verticalAlign: '-1px', marginLeft: 5, color: 'var(--code-high)' }} />
                    )}
                  </div>
                  <div className="mono" style={{ fontSize: '0.7rem', color: 'var(--ink-muted)', marginTop: 2 }}>
                    {plan.targets.kcal} kcal · {plan.targets.carbs}g C
                    {plan.plannedDeficit > 40 ? ` · cut -${plan.plannedDeficit}` : ' · full fuel'}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                <span className={`carb-badge ${plan.categoryMeta.color}`}>{plan.categoryMeta.badge}</span>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    openEditor(date, session);
                  }}
                >
                  Edit
                </button>
              </div>
            </div>
          );
        })}
      </section>

      {editingDate && (
        <div className="modal-backdrop" onClick={() => setEditingDate(null)} role="dialog" aria-modal="true">
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="modal-handle" />
            <div className="modal-head">
              <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <Bike size={18} /> Session · {editingDate}
              </h2>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="field-grid">
                <div className="field full">
                  <label htmlFor="sess-title">Workout Title</label>
                  <input
                    id="sess-title"
                    className="input"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="e.g., Threshold 3×15m"
                  />
                </div>

                <div className="field">
                  <label htmlFor="sess-intensity">Intensity / Type</label>
                  <select
                    id="sess-intensity"
                    className="select"
                    value={form.intensity}
                    onChange={(e) => setForm({ ...form, intensity: e.target.value })}
                  >
                    {INTENSITY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label htmlFor="sess-timing">Time of Day</label>
                  <select
                    id="sess-timing"
                    className="select"
                    value={form.timing}
                    onChange={(e) => setForm({ ...form, timing: e.target.value })}
                  >
                    <option value="morning">Morning</option>
                    <option value="midday">Midday</option>
                    <option value="evening">Afternoon / Evening</option>
                  </select>
                </div>

                {form.intensity !== 'rest' && (
                  <>
                    <div className="field">
                      <label htmlFor="sess-dur">Duration (min)</label>
                      <input
                        id="sess-dur"
                        type="number"
                        className="input mono"
                        value={form.durationMin}
                        onChange={(e) => setForm({ ...form, durationMin: e.target.value })}
                        min={15}
                        max={600}
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="sess-kj">Work (kJ from power meter)</label>
                      <input
                        id="sess-kj"
                        type="number"
                        className="input mono"
                        value={form.plannedKj}
                        onChange={(e) => setForm({ ...form, plannedKj: e.target.value })}
                        min={0}
                        max={8000}
                      />
                    </div>
                    <div className="field full">
                      <label htmlFor="sess-status">Status</label>
                      <select
                        id="sess-status"
                        className="select"
                        value={form.status}
                        onChange={(e) => setForm({ ...form, status: e.target.value })}
                      >
                        <option value="planned">Planned</option>
                        <option value="completed">Completed</option>
                      </select>
                    </div>
                  </>
                )}
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                  <Plus size={15} /> Save & Update Carb Code
                </button>
                <button type="button" className="btn" onClick={() => setEditingDate(null)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
