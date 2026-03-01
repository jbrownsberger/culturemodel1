// Core simulation model — ported from Python

export const PRACTICE_COLORS = {
  work:             '#c1440e',
  church:           '#7c3aed',
  club:             '#1d6fa4',
  education:        '#1a6b4a',
  political_org:    '#b45309',
  community_center: '#0e7490',
  none:             '#9ca3af',
};

export const PRACTICE_LABELS = {
  work:             'Work',
  church:           'Church',
  club:             'Club',
  education:        'Education',
  political_org:    'Civic Org',
  community_center: 'Comm. Center',
  none:             'None',
};

export const INSTITUTION_ICONS = {
  work:             '🏢',
  church:           '⛪',
  club:             '🎳',
  education:        '🏫',
  political_org:    '🏛',
  community_center: '🏡',
  shopping:         '🛒',
};

const PRACTICE_PROFILES = {
  work: {
    optimalHours: 40, dr: 1.5,
    benefits: { community:0.01, tradition:0.0, growth:0.02, civic:0.01, status:0.03, leisure:-0.05, material:0.0 }
  },
  church: {
    optimalHours: 10, dr: 1.3,
    benefits: { community:0.15, tradition:0.12, growth:0.05, civic:0.06, status:0.04, leisure:0.0, material:0.0 }
  },
  club: {
    optimalHours:  6, dr: 1.4,
    benefits: { community:0.10, tradition:0.02, growth:0.08, civic:0.03, status:0.06, leisure:0.05, material:0.0 }
  },
  education: {
    optimalHours: 20, dr: 1.1,
    benefits: { community:0.05, tradition:0.04, growth:0.15, civic:0.05, status:0.10, leisure:0.0, material:0.0 }
  },
  political_org: {
    optimalHours: 15, dr: 1.2,
    benefits: { community:0.07, tradition:0.03, growth:0.06, civic:0.15, status:0.09, leisure:0.0, material:0.0 }
  },
  community_center: {
    optimalHours: 30, dr: 1.2,
    benefits: { community:0.12, tradition:0.08, growth:0.04, civic:0.02, status:0.02, leisure:0.08, material:0.0 }
  },
  shopping: {
    optimalHours: 3, dr: 1.8,  // Very diminishing - shopping more doesn't help much
    benefits: { community:0.0, tradition:0.0, growth:0.0, civic:0.0, status:0.02, leisure:0.02, material:0.0 }
    // material benefit calculated separately based on money spent
  },
};

const MAX_HOURS = { work:60, church:20, club:15, political_org:30, education:40, community_center:50, shopping:10 };

// Exclusive groups - agents can only join ONE institution per group
const EXCLUSIVE_GROUPS = {
  work:   'employment',
  church: 'religious',
  // clubs, education, community_center, shopping are NOT exclusive
};

// ── Seeded RNG for reproducibility ──────────────────────────────────────────
function mulberry32(seed) {
  return function() {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// ── Agent ────────────────────────────────────────────────────────────────────
function createAgent(id, rand) {
  return {
    id,
    position: [rand(), rand()],
    values: {
      community: rand(),
      tradition: rand(),
      growth:    rand(),
      civic:     rand(),
      status:    rand(),
      leisure:   rand(),
      material:  rand(),  // Replaces wealth - desire for material goods
    },
    timeBudget:  168,
    moneyBudget: 500 + rand() * 1500,  // Starting savings
    materialSatisfaction: 0.5,  // Current satisfaction level (0-1)
    timeAllocation: {},     // { instName: hours }
    institutions: new Set(),
    awareOf:      new Set(),
    commStrength: 0.5 + rand() * 0.5,
    stepsSinceChange: 100,
  };
}

function applyValueSettings(agent, valueSettings, rand) {
  for (const [k, [mean, std]] of Object.entries(valueSettings)) {
    // Box-Muller for normal distribution
    const u1 = Math.max(1e-10, rand());
    const u2 = rand();
    const z  = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    agent.values[k] = Math.min(1, Math.max(0, mean + z * std));
  }
}

function getFreeTime(agent) {
  return agent.timeBudget - Object.values(agent.timeAllocation).reduce((s, h) => s + h, 0);
}

function getDominantPractice(agent, institutions) {
  const totals = {};
  for (const [name, hours] of Object.entries(agent.timeAllocation)) {
    const inst = institutions[name];
    if (inst && inst.practiceType !== 'work') {
      totals[inst.practiceType] = (totals[inst.practiceType] || 0) + hours;
    }
  }
  if (!Object.keys(totals).length) return 'none';
  return Object.entries(totals).sort((a, b) => b[1] - a[1])[0][0];
}

// ── Institution ──────────────────────────────────────────────────────────────
function createInstitution(config, rand) {
  return {
    name:              config.name,
    practiceType:      config.type,
    size:              config.size,
    members:           new Set(),
    culture:           { ...config.culture },
    moneyCostPerHour:  config.money_cost || 0,
    moneyIncomePerHour:config.money_income || 0,
    position:          [rand(), rand()],
  };
}

// ── Utility calculations ─────────────────────────────────────────────────────
function calcUtility(agent, instName, hours, institutions, currentAllocation = {}) {
  if (hours <= 0) return 0;
  const inst    = institutions[instName];
  if (!inst) return 0;
  const profile = PRACTICE_PROFILES[inst.practiceType];
  if (!profile) return 0;

  const eff = Math.pow(hours, 1 / profile.dr);
  let u = 0;
  
  // Direct value benefits from activity
  for (const [dim, benefit] of Object.entries(profile.benefits)) {
    u += benefit * (agent.values[dim] || 0) * eff;
  }
  
  // Special handling for shopping: material satisfaction from money spent
  if (inst.practiceType === 'shopping') {
    const moneySpent = hours * inst.moneyCostPerHour;
    const materialGain = calcMaterialGain(moneySpent);
    const materialDeficit = agent.values.material - agent.materialSatisfaction;
    u += materialGain * Math.max(0, materialDeficit) * 10; // High value if unsatisfied
  }
  
  // Money cost (negative utility for non-work)
  if (inst.practiceType !== 'work') {
    u -= hours * inst.moneyCostPerHour * 0.001; // Small direct cost
  }
  
  // Income value is INSTRUMENTAL - based on ability to satisfy material needs
  if (inst.practiceType === 'work') {
    const potentialIncome = hours * inst.moneyIncomePerHour;
    const materialDeficit = agent.values.material - agent.materialSatisfaction;
    
    // Income is valuable only if you have unmet material needs
    if (materialDeficit > 0) {
      // Calculate how much shopping this income could buy
      const affordableShoppingHours = potentialIncome / 50; // Assume $50/hr shopping cost
      const potentialMaterialGain = calcMaterialGain(potentialIncome);
      u += potentialMaterialGain * materialDeficit * 5; // Value income for what it can buy
    }
  }
  
  return u;
}

// Material satisfaction from spending money
function calcMaterialGain(moneySpent) {
  // Logarithmic - $100 does a lot, but $1000 isn't 10x better
  return Math.log(1 + moneySpent / 100) * 0.3;
}

function marginalUtility(agent, instName, currentHours, institutions, currentAllocation) {
  return calcUtility(agent, instName, currentHours + 1, institutions, currentAllocation)
       - calcUtility(agent, instName, currentHours,     institutions, currentAllocation);
}

function optimizeAllocation(agent, institutions) {
  // PHASE 1: Choose best option from each exclusive group
  const exclusiveChoices = {};
  const groupInsts = {};
  
  // Group institutions by exclusivity
  for (const instName of agent.awareOf) {
    const inst = institutions[instName];
    if (!inst) continue;
    const group = EXCLUSIVE_GROUPS[inst.practiceType];
    if (group) {
      if (!groupInsts[group]) groupInsts[group] = [];
      groupInsts[group].push(instName);
    }
  }
  
  // Pick best from each exclusive group
  for (const [group, instNames] of Object.entries(groupInsts)) {
    let bestInst = null;
    let bestUtility = -Infinity;
    
    for (const instName of instNames) {
      const inst = institutions[instName];
      if (!inst || inst.members.size >= inst.size) continue;
      
      // Estimate utility of committing reasonable hours to this institution
      const testHours = inst.practiceType === 'work' ? 40 : 
                       inst.practiceType === 'church' ? 5 : 10;
      const u = calcUtility(agent, instName, testHours, institutions, {});
      
      if (u > bestUtility) {
        bestUtility = u;
        bestInst = instName;
      }
    }
    
    if (bestInst) {
      exclusiveChoices[bestInst] = 0; // Will allocate hours below
    }
  }
  
  // PHASE 2: Greedy allocation across chosen exclusives + non-exclusives
  const allocation = { ...exclusiveChoices };
  
  // Add non-exclusive institutions to allocation pool
  for (const instName of agent.awareOf) {
    const inst = institutions[instName];
    if (!inst) continue;
    const group = EXCLUSIVE_GROUPS[inst.practiceType];
    if (!group && !(instName in allocation)) {
      allocation[instName] = 0;
    }
  }
  
  let timeLeft = agent.timeBudget;
  
  // Greedy hour allocation
  for (let iter = 0; iter < agent.timeBudget; iter++) {
    if (timeLeft <= 0) break;

    let bestInst = null, bestMU = 0.005;

    for (const name of Object.keys(allocation)) {
      const inst = institutions[name];
      if (!inst) continue;
      const cur    = allocation[name] || 0;
      const maxHrs = MAX_HOURS[inst.practiceType] || 50;
      if (cur >= maxHrs) continue;

      // Affordability check
      if (inst.practiceType !== 'work' && inst.moneyCostPerHour > 0) {
        const income = Object.entries(allocation)
          .reduce((s, [n, h]) => s + h * (institutions[n]?.moneyIncomePerHour || 0), 0);
        const costs  = Object.entries(allocation)
          .reduce((s, [n, h]) => s + h * (institutions[n]?.moneyCostPerHour  || 0), 0);
        const bal    = agent.moneyBudget + income - costs;
        
        if (bal - inst.moneyCostPerHour < 0) continue;
      }

      const mu = marginalUtility(agent, name, cur, institutions, allocation);
      if (mu > bestMU) { bestMU = mu; bestInst = name; }
    }

    if (!bestInst) break;
    allocation[bestInst] = (allocation[bestInst] || 0) + 1;
    timeLeft--;
  }

  return Object.fromEntries(Object.entries(allocation).filter(([, h]) => h >= 0.5));
}

// ── Network ──────────────────────────────────────────────────────────────────
function buildAdjacency(n, density, rand) {
  // Sparse adjacency as Map<id, Set<id>>
  // Start with minimal random connections (family/neighbors)
  const adj = new Map();
  for (let i = 0; i < n; i++) adj.set(i, new Set());

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (rand() < density) {
        adj.get(i).add(j);
        adj.get(j).add(i);
      }
    }
  }
  return adj;
}

function addConnection(adjacency, a, b) {
  if (a === b) return;
  adjacency.get(a).add(b);
  adjacency.get(b).add(a);
}

function removeConnection(adjacency, a, b) {
  adjacency.get(a).delete(b);
  adjacency.get(b).delete(a);
}

// Dynamic connection formation each step
function updateConnections(adjacency, institutions, agents, rand, params) {
  const {
    randomConnectionProb = 0.05,      // 5% chance of random meeting per step
    institutionConnectionProb = 0.30,  // 30% chance with institution co-members
    connectionBreakProb = 0.02,        // 2% chance any connection breaks
  } = params;

  // 1. Random connections (chance encounters)
  for (let i = 0; i < agents.length; i++) {
    if (rand() < randomConnectionProb) {
      const j = Math.floor(rand() * agents.length);
      if (i !== j) addConnection(adjacency, i, j);
    }
  }

  // 2. Institution-based connections
  for (const inst of Object.values(institutions)) {
    const members = [...inst.members];
    if (members.length < 2) continue;
    
    // Each member has a chance to connect with other members
    for (const memberId of members) {
      if (rand() < institutionConnectionProb) {
        const otherIdx = Math.floor(rand() * members.length);
        const otherId = members[otherIdx];
        if (memberId !== otherId) {
          addConnection(adjacency, memberId, otherId);
        }
      }
    }
  }

  // 3. Connection decay
  for (let i = 0; i < agents.length; i++) {
    const neighbors = [...adjacency.get(i)];
    for (const j of neighbors) {
      if (j > i && rand() < connectionBreakProb) {
        removeConnection(adjacency, i, j);
      }
    }
  }
}

// ── Broadcast awareness ──────────────────────────────────────────────────────
function broadcastAwareness(agents, institutions, radius) {
  for (const agent of agents) {
    for (const [name, inst] of Object.entries(institutions)) {
      const dx = agent.position[0] - inst.position[0];
      const dy = agent.position[1] - inst.position[1];
      if (Math.sqrt(dx*dx + dy*dy) <= radius) {
        agent.awareOf.add(name);
      }
    }
  }
}

// ── Main model factory ───────────────────────────────────────────────────────
export function createModel(config) {
  const {
    nAgents         = 100,
    institutionDefs = [],
    valueSettings   = {},
    networkDensity  = 0.03,
    awarenessRadius = 0.3,
    reallocFreq     = 4,
    seed            = 42,
    connectionParams = {
      randomConnectionProb: 0.05,
      institutionConnectionProb: 0.30,
      connectionBreakProb: 0.02,
    },
  } = config;

  const rand = mulberry32(seed);

  // Create agents
  const agents = Array.from({ length: nAgents }, (_, i) => {
    const a = createAgent(i, rand);
    applyValueSettings(a, valueSettings, rand);
    return a;
  });

  // Create institutions
  const institutions = {};
  for (const def of institutionDefs) {
    const key = `${def.type}_${def.name.replace(/\s+/g,'_')}`;
    institutions[key] = createInstitution(def, rand);
  }

  // Broadcast spatial awareness
  broadcastAwareness(agents, institutions, awarenessRadius);

  // Initial memberships
  for (const agent of agents) {
    for (const instName of agent.awareOf) {
      const inst = institutions[instName];
      if (!inst) continue;
      const fit = Object.entries(inst.culture)
        .reduce((s, [k, v]) => s + v * (agent.values[k] || 0), 0);
      if (fit > 0 && rand() < 0.3 && inst.members.size < inst.size) {
        inst.members.add(agent.id);
        agent.institutions.add(instName);
        const hrs = inst.practiceType === 'work'   ? 40
                  : inst.practiceType === 'church'  ? 3 + rand() * 5
                  : inst.practiceType === 'club'    ? 2 + rand() * 4
                  : inst.practiceType === 'education'? 10 + rand() * 10
                  : 5 + rand() * 10;
        agent.timeAllocation[instName] = hrs;
      }
    }
  }

  // Build network
  const adjacency = buildAdjacency(nAgents, networkDensity, rand);
  // NOTE: No longer auto-connecting everyone in institutions!
  // Connections form dynamically during simulation via updateConnections()

  // History
  const history = { step: [], ...Object.fromEntries(
    Object.keys(PRACTICE_PROFILES).flatMap(p => [
      [`${p}_rate`, []],
      [`${p}_hours`, []],
    ])
  )};

  const model = { agents, institutions, adjacency, history, step: 0,
                  reallocFreq, awarenessRadius, rand, connectionParams };

  recordState(model);
  return model;
}

function recordState(model) {
  const { agents, institutions, history, step } = model;
  history.step.push(step);

  for (const ptype of Object.keys(PRACTICE_PROFILES)) {
    let totalHours = 0, participants = 0;
    for (const agent of agents) {
      let agentHours = 0;
      for (const [name, hrs] of Object.entries(agent.timeAllocation)) {
        if (institutions[name]?.practiceType === ptype) agentHours += hrs;
      }
      totalHours   += agentHours;
      if (agentHours > 0) participants++;
    }
    history[`${ptype}_rate`].push(participants / agents.length);
    history[`${ptype}_hours`].push(totalHours / agents.length);
  }
}

// ── Step ─────────────────────────────────────────────────────────────────────
export function stepModel(model) {
  const { agents, institutions, adjacency, reallocFreq, rand, connectionParams } = model;

  // Shuffle agents
  const order = agents.map((_, i) => i).sort(() => rand() - 0.5);

  for (const idx of order) {
    const agent = agents[idx];
    agent.stepsSinceChange++;

    // Learn about institutions from neighbours
    for (const nbrId of (adjacency.get(agent.id) || [])) {
      const nbr = agents[nbrId];
      if (nbr.commStrength >= 0.2) {
        for (const inst of nbr.institutions) agent.awareOf.add(inst);
      }
    }

    // Re-optimise
    if (agent.stepsSinceChange >= reallocFreq) {
      const newAlloc = optimizeAllocation(agent, institutions);

      // Update institution membership
      const oldInsts = new Set(agent.institutions);
      const newInsts = new Set(Object.keys(newAlloc));

      for (const name of oldInsts) {
        if (!newInsts.has(name) && institutions[name]) {
          institutions[name].members.delete(agent.id);
        }
      }
      for (const name of newInsts) {
        if (!oldInsts.has(name) && institutions[name] &&
            institutions[name].members.size < institutions[name].size) {
          institutions[name].members.add(agent.id);
        }
      }

      agent.timeAllocation    = newAlloc;
      agent.institutions      = newInsts;
      agent.stepsSinceChange  = 0;
    }
  }

  // Dynamic connection updates - NEW!
  updateConnections(adjacency, institutions, agents, rand, connectionParams);

  // Update material satisfaction and money from shopping/work
  for (const agent of agents) {
    // Calculate income and spending this step
    let income = 0, spending = 0, materialGain = 0;
    
    for (const [instName, hours] of Object.entries(agent.timeAllocation)) {
      const inst = institutions[instName];
      if (!inst) continue;
      
      if (inst.practiceType === 'work') {
        income += hours * inst.moneyIncomePerHour;
      } else if (inst.practiceType === 'shopping') {
        const cost = hours * inst.moneyCostPerHour;
        spending += cost;
        materialGain += calcMaterialGain(cost);
      } else {
        spending += hours * inst.moneyCostPerHour;
      }
    }
    
    // Update money (weekly basis)
    agent.moneyBudget += (income - spending) / 4; // Assume step = 1 week, but smooth over month
    agent.moneyBudget = Math.max(0, agent.moneyBudget); // Can't go negative
    
    // Update material satisfaction (decays over time)
    agent.materialSatisfaction += materialGain;
    agent.materialSatisfaction *= 0.95; // 5% decay per step (things wear out, needs recur)
    agent.materialSatisfaction = Math.min(1, Math.max(0, agent.materialSatisfaction));
  }

  model.step++;
  recordState(model);

  return model;
}

// ── Accessors ────────────────────────────────────────────────────────────────
export { getFreeTime, getDominantPractice, PRACTICE_PROFILES };
