import { useMemo, useState } from 'react';
import { Bike, Dumbbell, Activity, Plus, CheckCircle2, RefreshCw, Trash2 } from 'lucide-react';
import { getIsoDate } from '../engine/defaultData';
import {
  computeDailyPlan,
  INTENSITY_OPTIONS,
  normalizeSportKind,
  SPORT_OPTIONS,
} from '../engine/fuelingEngine';
import NumericInput from './NumericInput';

function formatShortDay(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return {
    dow: dt.toLocaleDateString('en-US', { weekday: 'short' }),
    dayNum: d,
    isToday: iso === getIsoDate(0),
  };
}

function SportIcon({ sport, title, size = 13 }) {
  const kind = normalizeSportKind(sport, title);
  if (kind === 'ride') return <Bike size={size} color="var(--code-high)" />;
  if (kind === 'strength') return <Dumbbell size={size} color="var(--code-med)" />;
  return <Activity size={size} color="var(--macro-protein)" />;
}

export default function TrainingView({
  selectedDate,
  todayIso,
  onSelectDate,
  sessions,
  profile,
  biometricsSummary,
  onSaveSession,
  onDeleteSession,
  onNavigateTab,
}) {
  const defaultTiming = profile?.defaultWorkoutTiming || 'evening';
  const [editingDate, setEditingDate] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    title: '',
    sport: 'Ride',
    intensity: 'endurance',
    durationMin: 60,
    plannedKj: 800,
    actualKj: 0,
    plannedKcal: 350,
    actualKcal: 0,
    timing: defaultTiming,
    status: 'planned',
  });

  const sessionsByDate = useMemo(() => {
    const map = new Map();
    sessions.forEach((s) => {
      if (!s || !s.date) return;
      const list = map.get(s.date) || [];
      list.push(s);
      map.set(s.date, list);
    });
    return map;
  }, [sessions]);

  const effectiveToday = todayIso || getIsoDate(0);
  const weekDates = useMemo(
    () => [-1, 0, 1, 2, 3, 4, 5].map((off) => getIsoDate(off)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [effectiveToday]
  );

  const weekPlans = useMemo(() => {
    return weekDates.map((d, idx) => {
      const prevDate = idx > 0 ? weekDates[idx - 1] : getIsoDate(-2);
      const nextDate = idx < weekDates.length - 1 ? weekDates[idx + 1] : getIsoDate(6);
      const daySessions = sessionsByDate.get(d) || [];
      const plan = computeDailyPlan({
        date: d,
        profile,
        biometricsSummary,
        todaySessions: daySessions,
        tomorrowSessions: sessionsByDate.get(nextDate) || [],
        yesterdaySessions: sessionsByDate.get(prevDate) || [],
      });
      return { date: d, workouts: plan.workouts, plan };
    });
  }, [weekDates, sessionsByDate, profile, biometricsSummary]);

  const weeklyDeficitTotal = weekPlans.reduce((sum, item) => sum + item.plan.plannedDeficit, 0);
  const weeklyCarbsTotal = weekPlans.reduce((sum, item) => sum + item.plan.targets.carbs, 0);
  const weeklyKcalTotal = weekPlans.reduce((sum, item) => sum + item.plan.exerciseKcal, 0);

  const openEditor = (iso, existing = null) => {
    setEditingDate(iso);
    setEditingId(existing?.id || null);
    const sport = existing?.sport || 'Ride';
    const isRide = normalizeSportKind(sport, existing?.title) === 'ride';
    setForm({
      title: existing?.title || (isRide ? 'Zone 2 Endurance Ride' : 'Gym / Strength Session'),
      sport,
      intensity: existing?.intensity || 'endurance',
      durationMin: existing?.durationMin ?? (isRide ? 90 : 45),
      plannedKj: existing?.plannedKj ?? 950,
      actualKj: existing?.actualKj ?? 0,
      plannedKcal: existing?.plannedKcal || existing?.kcal || 280,
      actualKcal: existing?.actualKcal || 0,
      timing: existing?.timing || defaultTiming,
      status: existing?.status || 'planned',
    });
  };

  const formSportKind = normalizeSportKind(form.sport, form.title);
  const isFormRide = formSportKind === 'ride';
  const isFormRest = form.sport === 'Rest' || form.intensity === 'rest';

  const handleSportChange = (nextSport) => {
    const nextKind = normalizeSportKind(nextSport, '');
    const defaultTitle =
      nextKind === 'ride'
        ? 'Zone 2 Endurance Ride'
        : nextKind === 'strength'
        ? 'Gym / Strength Training'
        : nextKind === 'run'
        ? 'Aerobic Run'
        : nextKind === 'swim'
        ? 'Pool Swim'
        : nextKind === 'rest'
        ? 'Rest Day'
        : 'Mobility / Cross-Training';
    setForm((prev) => ({
      ...prev,
      sport: nextSport,
      title: !editingId ? defaultTitle : prev.title,
      intensity: nextKind === 'rest' ? 'rest' : prev.intensity === 'rest' ? 'endurance' : prev.intensity,
      durationMin: nextKind === 'strength' && prev.durationMin > 75 ? 45 : prev.durationMin,
      plannedKcal: nextKind === 'strength' ? 280 : nextKind === 'run' ? 520 : prev.plannedKcal,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!editingDate) return;
    if (isFormRest) {
      if (editingId && onDeleteSession) {
        onDeleteSession(editingId, form.title);
      }
      setEditingDate(null);
      setEditingId(null);
      return;
    }

    const dur = Math.max(5, Number(form.durationMin) || 45);
    const pKj = isFormRide ? Math.max(0, Number(form.plannedKj) || 0) : 0;
    const aKj = isFormRide && form.status === 'completed' ? Math.max(0, Number(form.actualKj || pKj) || 0) : 0;
    const pKcal = !isFormRide ? Math.max(0, Number(form.plannedKcal) || 0) : 0;
    const aKcal = !isFormRide && form.status === 'completed' ? Math.max(0, Number(form.actualKcal || pKcal) || 0) : 0;

    onSaveSession({
      id: editingId || `manual-${editingDate}-${Date.now()}`,
      date: editingDate,
      title: form.title.trim() || (isFormRide ? 'Cycling Session' : 'Workout'),
      sport: form.sport || 'Ride',
      intensity: form.intensity === 'rest' ? 'endurance' : form.intensity,
      durationMin: dur,
      plannedKj: pKj,
      actualKj: aKj,
      plannedKcal: pKcal,
      actualKcal: aKcal,
      timing: form.timing,
      status: form.status,
      source: 'manual',
    });
    setEditingDate(null);
    setEditingId(null);
  };

  return (
    <>
      <section className="card">
        <div className="section-header">
          <div>
            <h1 className="section-title" style={{ fontSize: '1.08rem' }}>7-Day Periodized Fuel Wave</h1>
            <p className="muted-text" style={{ marginTop: 3 }}>
              Supports multiple workouts per day (e.g., morning Gym + evening Ride). Carbs &amp; calories adjust for your full day&apos;s load.
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
            <div className="mini-stat-label">7d Training</div>
            <div className="mini-stat-val mono">{weeklyKcalTotal.toLocaleString()} kcal</div>
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
        {weekPlans.map(({ date, workouts, plan }) => {
          const info = formatShortDay(date);
          const isSelected = date === selectedDate;
          return (
            <div
              key={date}
              className={`week-row ${isSelected ? 'selected' : ''}`}
              style={{ flexDirection: 'column', alignItems: 'stretch', gap: 7 }}
              onClick={() => {
                onSelectDate(date);
                onNavigateTab('today');
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                <div className="week-row-left" style={{ flex: 1 }}>
                  <div
                    className="day-pill"
                    style={info.isToday ? { borderColor: 'var(--code-high)', background: 'var(--code-high-bg)' } : undefined}
                  >
                    <div className="day-pill-dow">{info.isToday ? 'TDY' : info.dow}</div>
                    <div className="day-pill-num mono">{info.dayNum}</div>
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: 800, fontSize: '0.86rem' }}>
                      {workouts.length === 0
                        ? 'Rest Day'
                        : workouts.length === 1
                        ? workouts[0].title
                        : `${workouts.length} Workouts`}
                    </div>
                    <div className="mono" style={{ fontSize: '0.7rem', color: 'var(--ink-secondary)', marginTop: 2 }}>
                      {plan.targets.kcal} kcal · {plan.targets.carbs}g C
                      {plan.exerciseKcal > 0 ? ` · ${plan.exerciseKcal} kcal burned` : ' · Rest'}
                      {plan.plannedDeficit > 40 ? ` · cut -${plan.plannedDeficit}` : ''}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  <span className={`carb-badge ${plan.categoryMeta.color}`}>{plan.categoryMeta.badge}</span>
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      openEditor(date, null);
                    }}
                    aria-label={`Add workout on ${date}`}
                  >
                    <Plus size={12} /> Add
                  </button>
                </div>
              </div>

              {/* Individual workouts list for this day */}
              {workouts.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingLeft: 4 }}>
                  {workouts.map((w) => (
                    <div
                      key={w.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 8,
                        padding: '5px 8px',
                        borderRadius: 8,
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border-hairline)',
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditor(date, w);
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                        <SportIcon sport={w.sport} title={w.title} />
                        <span style={{ fontWeight: 700, fontSize: '0.76rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {w.title}
                        </span>
                        {w.status === 'completed' ? (
                          <CheckCircle2 size={12} color="var(--code-high)" style={{ flexShrink: 0 }} />
                        ) : (
                          <span style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--ink-muted)' }}>Planned</span>
                        )}
                      </div>
                      <div className="mono" style={{ fontSize: '0.7rem', color: 'var(--ink-secondary)', flexShrink: 0 }}>
                        {w.durationMin}m · {w.kj > 0 ? `${w.kj} kJ` : `${w.kcal} kcal`}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </section>

      {editingDate && (
        <div className="modal-backdrop" onClick={() => setEditingDate(null)} role="dialog" aria-modal="true" aria-label="Edit or Add Workout">
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="modal-handle" />
            <div className="modal-head">
              <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <SportIcon sport={form.sport} title={form.title} size={18} />
                {editingId ? 'Edit Workout' : 'Add Workout'} · {editingDate}
              </h2>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="field-grid">
                <div className="field">
                  <label htmlFor="sess-sport">Workout Type</label>
                  <select
                    id="sess-sport"
                    className="select"
                    value={form.sport}
                    onChange={(e) => handleSportChange(e.target.value)}
                  >
                    {SPORT_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
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

                <div className="field full">
                  <label htmlFor="sess-title">Workout Title</label>
                  <input
                    id="sess-title"
                    className="input"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder={isFormRide ? 'e.g., Threshold 3×15m' : 'e.g., Morning Gym / Legs & Core'}
                  />
                </div>

                {!isFormRest && (
                  <>
                    <div className="field">
                      <label htmlFor="sess-intensity">Intensity</label>
                      <select
                        id="sess-intensity"
                        className="select"
                        value={form.intensity}
                        onChange={(e) => setForm({ ...form, intensity: e.target.value })}
                      >
                        {INTENSITY_OPTIONS.filter((o) => o.value !== 'rest').map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="field">
                      <label htmlFor="sess-dur">Duration (min)</label>
                      <NumericInput
                        id="sess-dur"
                        className="input mono"
                        value={form.durationMin}
                        onChange={(val) => setForm({ ...form, durationMin: val })}
                        min={5}
                        max={600}
                        fallback={45}
                      />
                    </div>

                    {isFormRide ? (
                      <div className="field">
                        <label htmlFor="sess-kj">Power Work (kJ)</label>
                        <NumericInput
                          id="sess-kj"
                          className="input mono"
                          value={form.status === 'completed' ? form.actualKj || form.plannedKj : form.plannedKj}
                          onChange={(val) =>
                            setForm({
                              ...form,
                              plannedKj: val,
                              ...(form.status === 'completed' ? { actualKj: val } : {}),
                            })
                          }
                          min={0}
                          max={8000}
                          fallback={0}
                        />
                      </div>
                    ) : (
                      <div className="field">
                        <label htmlFor="sess-kcal">Calories Burned (kcal)</label>
                        <NumericInput
                          id="sess-kcal"
                          className="input mono"
                          value={form.status === 'completed' ? form.actualKcal || form.plannedKcal : form.plannedKcal}
                          onChange={(val) =>
                            setForm({
                              ...form,
                              plannedKcal: val,
                              ...(form.status === 'completed' ? { actualKcal: val } : {}),
                            })
                          }
                          min={0}
                          max={4000}
                          fallback={250}
                        />
                      </div>
                    )}

                    <div className="field">
                      <label htmlFor="sess-status">Status</label>
                      <select
                        id="sess-status"
                        className="select"
                        value={form.status}
                        onChange={(e) => setForm({ ...form, status: e.target.value })}
                      >
                        <option value="planned">Scheduled / Planned</option>
                        <option value="completed">Completed</option>
                      </select>
                    </div>
                  </>
                )}
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                  <Plus size={15} /> Save Workout
                </button>
                {editingId && onDeleteSession && (
                  <button
                    type="button"
                    className="btn"
                    onClick={() => {
                      onDeleteSession(editingId, form.title);
                      setEditingDate(null);
                      setEditingId(null);
                    }}
                    aria-label="Delete workout"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
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
