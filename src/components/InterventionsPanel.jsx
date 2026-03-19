import React, { useState } from 'react';
import { INSTITUTION_ICONS } from '../lib/simulation';
import './InterventionsPanel.css';

export default function InterventionsPanel({ sim }) {
  const [section, setSection] = useState('institutions'); // 'institutions' | 'agents' | 'values'
  const [newInstForm, setNewInstForm] = useState({
    name: '', type: 'club', size: 25, money_cost: 0, money_income: 0,
    culture: { community: 0, tradition: 0, growth: 0, civic: 0, status: 0 },
  });

  const { model } = sim;

  if (!model) {
    return (
      <div className="interventions-empty">
        <p>Initialize a model to enable interventions</p>
      </div>
    );
  }

  // Add institution during simulation
  const handleAddInstitution = () => {
    if (!newInstForm.name.trim()) return;
    
    const wasRunning = sim.isRunning;
    if (wasRunning) sim.stopAnimation();

    // Create new institution in the live model
    const instKey = `${newInstForm.type}_${newInstForm.name.replace(/\s+/g, '_')}`;
    const newInst = {
      name: newInstForm.name,
      practiceType: newInstForm.type,
      size: newInstForm.size,
      members: new Set(),
      culture: { ...newInstForm.culture },
      moneyCostPerHour: newInstForm.money_cost,
      moneyIncomePerHour: newInstForm.money_income,
      position: [Math.random(), Math.random()],
    };

    model.institutions[instKey] = newInst;

    // Broadcast awareness to nearby agents
    for (const agent of model.agents) {
      const dx = agent.position[0] - newInst.position[0];
      const dy = agent.position[1] - newInst.position[1];
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= model.awarenessRadius) {
        agent.awareOf.add(instKey);
      }
    }

    setNewInstForm({
      name: '', type: 'club', size: 25, money_cost: 0, money_income: 0,
      culture: { community: 0, tradition: 0, growth: 0, civic: 0, status: 0 },
    });

    if (wasRunning) sim.startAnimation(400);
  };

  // Remove institution
  const handleRemoveInstitution = (instKey) => {
    const wasRunning = sim.isRunning;
    if (wasRunning) sim.stopAnimation();

    // Remove from agents' awareness and memberships
    for (const agent of model.agents) {
      agent.awareOf.delete(instKey);
      agent.institutions.delete(instKey);
      delete agent.timeAllocation[instKey];
    }

    // Remove from model
    delete model.institutions[instKey];

    if (wasRunning) sim.startAnimation(400);
  };

  // Add N agents
  const handleAddAgents = (count) => {
    const wasRunning = sim.isRunning;
    if (wasRunning) sim.stopAnimation();

    const startId = model.agents.length;

    for (let i = 0; i < count; i++) {
      const agent = {
        id: startId + i,
        position: [Math.random(), Math.random()],
        values: {
          community: Math.random(),
          tradition: Math.random(),
          growth: Math.random(),
          civic: Math.random(),
          status: Math.random(),
          leisure: Math.random(),
          material: Math.random(),
        },
        timeBudget: 168,
        moneyBudget: 500 + Math.random() * 1500,
        materialSatisfaction: Math.random() * 0.4,
        timeAllocation: {},
        institutions: new Set(),
        awareOf: new Set(),
        commStrength: 0.5 + Math.random() * 0.5,
        stepsSinceChange: 100,
      };

      // Broadcast awareness
      for (const [instName, inst] of Object.entries(model.institutions)) {
        const dx = agent.position[0] - inst.position[0];
        const dy = agent.position[1] - inst.position[1];
        if (Math.sqrt(dx * dx + dy * dy) <= model.awarenessRadius) {
          agent.awareOf.add(instName);
        }
      }

      model.agents.push(agent);
      model.adjacency.set(agent.id, new Set());
    }

    if (wasRunning) sim.startAnimation(400);
  };

  // Remove N random agents
  const handleRemoveAgents = (count) => {
    const wasRunning = sim.isRunning;
    if (wasRunning) sim.stopAnimation();

    const toRemove = Math.min(count, model.agents.length - 10); // Keep at least 10 agents

    for (let i = 0; i < toRemove; i++) {
      // Remove last agent
      const agent = model.agents.pop();
      
      // Remove from institutions
      for (const instName of agent.institutions) {
        model.institutions[instName]?.members.delete(agent.id);
      }

      // Remove from network
      model.adjacency.delete(agent.id);
      for (const neighbors of model.adjacency.values()) {
        neighbors.delete(agent.id);
      }
    }

    if (wasRunning) sim.startAnimation(400);
  };

  // Shift all agents' values
  const handleValueShift = (valueName, delta) => {
    const wasRunning = sim.isRunning;
    if (wasRunning) sim.stopAnimation();

    for (const agent of model.agents) {
      agent.values[valueName] = Math.min(1, Math.max(0, agent.values[valueName] + delta));
    }

    if (wasRunning) sim.startAnimation(400);
  };

  return (
    <div className="interventions-panel">
      <div className="interventions-tabs">
        {[
          ['institutions', '🏛️ Institutions'],
          ['agents', '👥 Population'],
          ['values', '💭 Values']
        ].map(([key, label]) => (
          <button
            key={key}
            className={`interventions-tab ${section === key ? 'active' : ''}`}
            onClick={() => setSection(key)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="interventions-content">
        {/* INSTITUTIONS */}
        {section === 'institutions' && (
          <>
            <h3 className="interventions-title">Add Institution</h3>
            <div className="intervention-form">
              <input
                className="intervention-input"
                placeholder="Institution name"
                value={newInstForm.name}
                onChange={e => setNewInstForm(f => ({ ...f, name: e.target.value }))}
              />
              <select
                className="intervention-select"
                value={newInstForm.type}
                onChange={e => setNewInstForm(f => ({ ...f, type: e.target.value }))}
              >
                {Object.keys(INSTITUTION_ICONS).map(t => (
                  <option key={t} value={t}>{INSTITUTION_ICONS[t]} {t.replace('_', ' ')}</option>
                ))}
              </select>
              <div className="intervention-row">
                <label>
                  Size
                  <input type="number" min="5" max="200"
                    value={newInstForm.size}
                    onChange={e => setNewInstForm(f => ({ ...f, size: +e.target.value }))} />
                </label>
                <label>
                  Cost $/h
                  <input type="number" min="0" step="1"
                    value={newInstForm.money_cost}
                    onChange={e => setNewInstForm(f => ({ ...f, money_cost: +e.target.value }))} />
                </label>
                <label>
                  Income $/h
                  <input type="number" min="0" step="1"
                    value={newInstForm.money_income}
                    onChange={e => setNewInstForm(f => ({ ...f, money_income: +e.target.value }))} />
                </label>
              </div>
              <button className="intervention-btn primary" onClick={handleAddInstitution}>
                ➕ Add Institution
              </button>
            </div>

            <h3 className="interventions-title">Current Institutions</h3>
            <div className="institution-list">
              {Object.entries(model.institutions).map(([key, inst]) => (
                <div key={key} className="institution-item">
                  <span className="inst-icon">{INSTITUTION_ICONS[inst.practiceType]}</span>
                  <div className="inst-info">
                    <span className="inst-name">{inst.name}</span>
                    <span className="inst-meta">
                      {inst.members.size}/{inst.size} members · {inst.practiceType}
                    </span>
                  </div>
                  <button
                    className="inst-remove-btn"
                    onClick={() => handleRemoveInstitution(key)}
                  >
                    🗑️
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

        {/* AGENTS */}
        {section === 'agents' && (
          <>
            <h3 className="interventions-title">Current Population: {model.agents.length}</h3>
            
            <div className="intervention-section">
              <h4>Add Agents (Immigration)</h4>
              <div className="intervention-buttons">
                {[5, 10, 20].map(n => (
                  <button
                    key={n}
                    className="intervention-btn"
                    onClick={() => handleAddAgents(n)}
                  >
                    + {n} agents
                  </button>
                ))}
              </div>
            </div>

            <div className="intervention-section">
              <h4>Remove Agents (Emigration)</h4>
              <div className="intervention-buttons">
                {[5, 10, 20].map(n => (
                  <button
                    key={n}
                    className="intervention-btn danger"
                    onClick={() => handleRemoveAgents(n)}
                    disabled={model.agents.length - n < 10}
                  >
                    − {n} agents
                  </button>
                ))}
              </div>
            </div>

            <div className="intervention-note">
              <strong>Note:</strong> New agents spawn with random values and positions. 
              They become aware of nearby institutions immediately.
            </div>
          </>
        )}

        {/* VALUES */}
        {section === 'values' && (
          <>
            <h3 className="interventions-title">Shift Population Values</h3>
            <p className="intervention-desc">
              Apply a value shift to all agents. Simulates cultural change events.
            </p>

            {Object.keys(model.agents[0].values).map(valueName => (
              <div key={valueName} className="value-shift-row">
                <span className="value-shift-label">{valueName}</span>
                <div className="value-shift-buttons">
                  <button
                    className="value-shift-btn"
                    onClick={() => handleValueShift(valueName, -0.2)}
                  >
                    −− (−20%)
                  </button>
                  <button
                    className="value-shift-btn"
                    onClick={() => handleValueShift(valueName, -0.1)}
                  >
                    − (−10%)
                  </button>
                  <button
                    className="value-shift-btn"
                    onClick={() => handleValueShift(valueName, +0.1)}
                  >
                    + (+10%)
                  </button>
                  <button
                    className="value-shift-btn"
                    onClick={() => handleValueShift(valueName, +0.2)}
                  >
                    ++ (+20%)
                  </button>
                </div>
              </div>
            ))}

            <div className="intervention-note">
              <strong>Examples:</strong>
              <ul>
                <li>Economic boom → +20% material</li>
                <li>Religious revival → +20% tradition</li>
                <li>Cultural liberalization → −15% tradition, +15% growth</li>
              </ul>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
