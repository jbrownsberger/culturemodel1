import React, { useState, useEffect } from 'react';
import { VICTORY_CONDITIONS, FAILURE_CONDITIONS, EVENT_TEMPLATES, calculateMetrics } from '../lib/gameMode';
import './GameDashboard.css';

export default function GameDashboard({ sim, gameMode, onEvent }) {
  const [activeEvent, setActiveEvent] = useState(null);
  const [eventLog, setEventLog] = useState([]);
  const [gameStatus, setGameStatus] = useState('playing'); // 'playing' | 'won' | 'lost'
  const [lossReason, setLossReason] = useState(null);

  const { model, currentStep } = sim;

  // Check for events
  useEffect(() => {
    if (!model || gameMode.mode !== 'challenge' || !sim.isRunning) return;
    
    // Check for random events
    if (!activeEvent && currentStep % 5 === 0 && currentStep > 0) {
      for (const eventTemplate of EVENT_TEMPLATES) {
        if (eventTemplate.trigger(model)) {
          setActiveEvent(eventTemplate);
          sim.stopAnimation(); // Pause for player decision
          break;
        }
      }
    }
  }, [currentStep, model, gameMode, activeEvent, sim]);

  // Check win/loss conditions
  useEffect(() => {
    if (!model || gameMode.mode !== 'challenge' || gameStatus !== 'playing') return;

    // Check failure conditions
    for (const failure of Object.values(FAILURE_CONDITIONS)) {
      if (failure.check(model)) {
        setGameStatus('lost');
        setLossReason(failure);
        sim.stopAnimation();
        return;
      }
    }

    // Check victory condition
    if (gameMode.objective && VICTORY_CONDITIONS[gameMode.objective.toUpperCase()]) {
      const victory = VICTORY_CONDITIONS[gameMode.objective.toUpperCase()];
      if (victory.check(model)) {
        setGameStatus('won');
        sim.stopAnimation();
      }
    }
  }, [model, gameMode, gameStatus, sim]);

  const handleEventChoice = (choice) => {
    if (!activeEvent || !model) return;

    const result = choice.effect(model);
    
    setEventLog(prev => [...prev, {
      step: currentStep,
      event: activeEvent.name,
      choice: choice.label,
      result,
    }]);

    setActiveEvent(null);
    onEvent?.({ event: activeEvent, choice, result });
    sim.startAnimation(400);
  };

  if (!model) return null;

  const metrics = calculateMetrics(model);

  return (
    <div className="game-dashboard">
      {/* Victory/Loss Screen */}
      {gameStatus !== 'playing' && (
        <div className="game-over-modal">
          <div className="game-over-content">
            {gameStatus === 'won' ? (
              <>
                <div className="game-over-icon">🎉</div>
                <h2 className="game-over-title">Victory!</h2>
                <p className="game-over-desc">
                  You achieved {VICTORY_CONDITIONS[gameMode.objective.toUpperCase()].name}
                </p>
              </>
            ) : (
              <>
                <div className="game-over-icon">{lossReason?.emoji || '💔'}</div>
                <h2 className="game-over-title">{lossReason?.name || 'Defeat'}</h2>
                <p className="game-over-desc">{lossReason?.description}</p>
              </>
            )}
            <div className="game-over-stats">
              <div>Final Population: {model.agents.length}</div>
              <div>Steps Survived: {currentStep}</div>
              <div>Avg Satisfaction: {(metrics.avgSatisfaction * 100).toFixed(0)}%</div>
            </div>
          </div>
        </div>
      )}

      {/* Event Modal */}
      {activeEvent && (
        <div className="event-modal">
          <div className="event-content">
            <h3 className="event-title">📜 {activeEvent.name}</h3>
            <p className="event-desc">{activeEvent.description}</p>
            <div className="event-choices">
              {activeEvent.choices.map((choice, i) => (
                <button
                  key={i}
                  className="event-choice-btn"
                  onClick={() => handleEventChoice(choice)}
                >
                  {choice.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Compact Dashboard */}
      <div className="dashboard-compact">
        {/* Objective Progress */}
        {gameMode.mode === 'challenge' && gameMode.objective && (
          <div className="objective-card">
            <div className="objective-header">
              <span className="objective-emoji">
                {VICTORY_CONDITIONS[gameMode.objective.toUpperCase()].emoji}
              </span>
              <span className="objective-name">
                {VICTORY_CONDITIONS[gameMode.objective.toUpperCase()].name}
              </span>
            </div>
            <ObjectiveProgress
              objective={gameMode.objective}
              model={model}
            />
          </div>
        )}

        {/* Key Metrics */}
        <div className="metrics-grid">
          <MetricCard
            label="Satisfaction"
            value={metrics.avgSatisfaction}
            format="percent"
            emoji="😊"
            threshold={0.5}
          />
          <MetricCard
            label="Avg Wealth"
            value={metrics.avgWealth}
            format="money"
            emoji="💰"
            threshold={1000}
          />
          <MetricCard
            label="Connections"
            value={metrics.networkDensity}
            format="percent"
            emoji="🤝"
            threshold={0.1}
          />
          <MetricCard
            label="Inequality"
            value={metrics.inequality}
            format="ratio"
            emoji="⚖️"
            threshold={3}
            invert
          />
        </div>

        {/* Cultural Values Summary */}
        <div className="values-summary">
          <div className="values-title">Cultural Values</div>
          <div className="values-bars">
            {Object.entries(metrics.avgValues).map(([key, value]) => (
              <div key={key} className="value-mini-bar">
                <span className="value-mini-label">{key}</span>
                <div className="value-mini-track">
                  <div
                    className="value-mini-fill"
                    style={{ width: `${value * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Event Log (last 3) */}
        {eventLog.length > 0 && (
          <div className="event-log-mini">
            <div className="event-log-title">Recent Events</div>
            {eventLog.slice(-3).reverse().map((entry, i) => (
              <div key={i} className="event-log-entry">
                <div className="event-log-step">Step {entry.step}</div>
                <div className="event-log-text">
                  <strong>{entry.event}:</strong> {entry.choice}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ObjectiveProgress({ objective, model }) {
  const victory = VICTORY_CONDITIONS[objective.toUpperCase()];
  if (!victory) return null;

  const progress = victory.progress(model);

  return (
    <div className="objective-progress">
      {Object.entries(progress).map(([key, { current, target }]) => {
        const pct = Math.min(100, (current / target) * 100);
        const met = current >= target;

        return (
          <div key={key} className="progress-row">
            <span className="progress-label">{key}</span>
            <div className="progress-bar">
              <div
                className={`progress-fill ${met ? 'met' : ''}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="progress-value">
              {typeof current === 'number' && current < 10
                ? current.toFixed(2)
                : Math.round(current)}
              {met ? ' ✓' : ''}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function MetricCard({ label, value, format, emoji, threshold, invert = false }) {
  let displayValue, status;

  if (format === 'percent') {
    displayValue = `${(value * 100).toFixed(0)}%`;
    status = invert ? value <= threshold : value >= threshold;
  } else if (format === 'money') {
    displayValue = `$${Math.round(value)}`;
    status = invert ? value <= threshold : value >= threshold;
  } else if (format === 'ratio') {
    displayValue = `${value.toFixed(1)}:1`;
    status = invert ? value <= threshold : value >= threshold;
  } else {
    displayValue = value.toFixed(2);
    status = invert ? value <= threshold : value >= threshold;
  }

  return (
    <div className={`metric-card ${status ? 'good' : 'warning'}`}>
      <div className="metric-emoji">{emoji}</div>
      <div className="metric-info">
        <div className="metric-label">{label}</div>
        <div className="metric-value">{displayValue}</div>
      </div>
    </div>
  );
}
