// Game modes, objectives, and challenge system

export const GAME_MODES = {
  SANDBOX: 'sandbox',
  CHALLENGE: 'challenge',
};

export const VICTORY_CONDITIONS = {
  RENAISSANCE: {
    id: 'renaissance',
    name: 'Cultural Renaissance',
    description: 'Achieve high growth and community values while maintaining prosperity',
    emoji: '🎨',
    check: (model) => {
      const avgGrowth = model.agents.reduce((s, a) => s + a.values.growth, 0) / model.agents.length;
      const avgCommunity = model.agents.reduce((s, a) => s + a.values.community, 0) / model.agents.length;
      const avgSatisfaction = model.agents.reduce((s, a) => s + (a.satisfaction || 0.5), 0) / model.agents.length;
      
      return avgGrowth > 0.65 && avgCommunity > 0.6 && avgSatisfaction > 0.6;
    },
    progress: (model) => {
      const avgGrowth = model.agents.reduce((s, a) => s + a.values.growth, 0) / model.agents.length;
      const avgCommunity = model.agents.reduce((s, a) => s + a.values.community, 0) / model.agents.length;
      const avgSatisfaction = model.agents.reduce((s, a) => s + (a.satisfaction || 0.5), 0) / model.agents.length;
      
      return {
        growth: { current: avgGrowth, target: 0.65 },
        community: { current: avgCommunity, target: 0.6 },
        satisfaction: { current: avgSatisfaction, target: 0.6 },
      };
    }
  },
  
  PROSPERITY: {
    id: 'prosperity',
    name: 'Economic Prosperity',
    description: 'Build wealth while keeping population satisfied',
    emoji: '💰',
    check: (model) => {
      const avgMoney = model.agents.reduce((s, a) => s + a.moneyBudget, 0) / model.agents.length;
      const avgMaterialSat = model.agents.reduce((s, a) => s + a.materialSatisfaction, 0) / model.agents.length;
      const avgSatisfaction = model.agents.reduce((s, a) => s + (a.satisfaction || 0.5), 0) / model.agents.length;
      
      return avgMoney > 1500 && avgMaterialSat > 0.7 && avgSatisfaction > 0.55;
    },
    progress: (model) => {
      const avgMoney = model.agents.reduce((s, a) => s + a.moneyBudget, 0) / model.agents.length;
      const avgMaterialSat = model.agents.reduce((s, a) => s + a.materialSatisfaction, 0) / model.agents.length;
      const avgSatisfaction = model.agents.reduce((s, a) => s + (a.satisfaction || 0.5), 0) / model.agents.length;
      
      return {
        avgWealth: { current: avgMoney, target: 1500 },
        materialSatisfaction: { current: avgMaterialSat, target: 0.7 },
        satisfaction: { current: avgSatisfaction, target: 0.55 },
      };
    }
  },
  
  HARMONY: {
    id: 'harmony',
    name: 'Social Harmony',
    description: 'Create a cohesive society with strong civic bonds',
    emoji: '☮️',
    check: (model) => {
      const avgCivic = model.agents.reduce((s, a) => s + a.values.civic, 0) / model.agents.length;
      const avgCommunity = model.agents.reduce((s, a) => s + a.values.community, 0) / model.agents.length;
      
      // Calculate network density
      let totalConnections = 0;
      for (const neighbors of model.adjacency.values()) {
        totalConnections += neighbors.size;
      }
      const networkDensity = totalConnections / (model.agents.length * 2);
      
      const avgSatisfaction = model.agents.reduce((s, a) => s + (a.satisfaction || 0.5), 0) / model.agents.length;
      
      return avgCivic > 0.6 && avgCommunity > 0.65 && networkDensity > 0.15 && avgSatisfaction > 0.6;
    },
    progress: (model) => {
      const avgCivic = model.agents.reduce((s, a) => s + a.values.civic, 0) / model.agents.length;
      const avgCommunity = model.agents.reduce((s, a) => s + a.values.community, 0) / model.agents.length;
      
      let totalConnections = 0;
      for (const neighbors of model.adjacency.values()) {
        totalConnections += neighbors.size;
      }
      const networkDensity = totalConnections / (model.agents.length * 2);
      
      const avgSatisfaction = model.agents.reduce((s, a) => s + (a.satisfaction || 0.5), 0) / model.agents.length;
      
      return {
        civic: { current: avgCivic, target: 0.6 },
        community: { current: avgCommunity, target: 0.65 },
        connections: { current: networkDensity, target: 0.15 },
        satisfaction: { current: avgSatisfaction, target: 0.6 },
      };
    }
  },
};

export const FAILURE_CONDITIONS = {
  REVOLUTION: {
    id: 'revolution',
    name: 'Revolution',
    description: 'High civic values + low satisfaction + inequality → uprising',
    emoji: '🔥',
    check: (model) => {
      const avgCivic = model.agents.reduce((s, a) => s + a.values.civic, 0) / model.agents.length;
      const avgSatisfaction = model.agents.reduce((s, a) => s + (a.satisfaction || 0.5), 0) / model.agents.length;
      
      // Calculate wealth inequality (Gini-ish)
      const wealths = model.agents.map(a => a.moneyBudget).sort((a, b) => a - b);
      const bottom20 = wealths.slice(0, Math.floor(wealths.length * 0.2));
      const top20 = wealths.slice(-Math.floor(wealths.length * 0.2));
      const avgBottom = bottom20.reduce((s, w) => s + w, 0) / bottom20.length;
      const avgTop = top20.reduce((s, w) => s + w, 0) / top20.length;
      const inequality = avgTop / Math.max(avgBottom, 100);
      
      return avgCivic > 0.65 && avgSatisfaction < 0.35 && inequality > 5;
    }
  },
  
  COLLAPSE: {
    id: 'collapse',
    name: 'Economic Collapse',
    description: 'Too many people in poverty → mass exodus',
    emoji: '💔',
    check: (model) => {
      const poorAgents = model.agents.filter(a => a.moneyBudget < 200).length;
      const povertyRate = poorAgents / model.agents.length;
      const avgSatisfaction = model.agents.reduce((s, a) => s + (a.satisfaction || 0.5), 0) / model.agents.length;
      
      return povertyRate > 0.5 && avgSatisfaction < 0.3;
    }
  },
  
  EXODUS: {
    id: 'exodus',
    name: 'Mass Emigration',
    description: 'Population drops below viable level',
    emoji: '🚪',
    check: (model) => {
      return model.agents.length < model.minPopulation || model.agents.length < 20;
    }
  },
};

// Random events that force player decisions
export const EVENT_TEMPLATES = [
  {
    id: 'crop_failure',
    name: 'Crop Failure',
    description: 'A harsh winter has destroyed crops. The population faces hardship.',
    trigger: (model) => model.step > 10 && Math.random() < 0.15,
    choices: [
      {
        label: 'Provide emergency aid (-$500 per agent)',
        effect: (model) => {
          for (const agent of model.agents) {
            agent.moneyBudget += 500;
          }
          return 'Your aid prevents starvation and earns gratitude.';
        }
      },
      {
        label: 'Let market forces prevail',
        effect: (model) => {
          for (const agent of model.agents) {
            agent.materialSatisfaction *= 0.7;
            agent.values.civic = Math.max(0, agent.values.civic - 0.1);
          }
          return 'The people suffer. Trust in leadership declines.';
        }
      },
    ]
  },
  
  {
    id: 'cultural_movement',
    name: 'Cultural Movement Emerges',
    description: 'Young people are embracing new ideas, questioning tradition.',
    trigger: (model) => {
      const avgGrowth = model.agents.reduce((s, a) => s + a.values.growth, 0) / model.agents.length;
      return model.step > 15 && avgGrowth > 0.6 && Math.random() < 0.2;
    },
    choices: [
      {
        label: 'Encourage innovation (+growth, -tradition)',
        effect: (model) => {
          for (const agent of model.agents) {
            if (Math.random() < 0.6) {
              agent.values.growth = Math.min(1, agent.values.growth + 0.15);
              agent.values.tradition = Math.max(0, agent.values.tradition - 0.1);
            }
          }
          return 'A creative renaissance begins. Traditional institutions struggle.';
        }
      },
      {
        label: 'Preserve traditional values',
        effect: (model) => {
          for (const agent of model.agents) {
            if (Math.random() < 0.4) {
              agent.values.tradition = Math.min(1, agent.values.tradition + 0.1);
              agent.values.growth = Math.max(0, agent.values.growth - 0.05);
            }
          }
          return 'Tradition is upheld. Some feel stifled.';
        }
      },
    ]
  },
  
  {
    id: 'trade_opportunity',
    name: 'Trade Opportunity',
    description: 'Merchants offer to establish a trade route, but it will disrupt local crafts.',
    trigger: (model) => {
      const hasShop = Object.values(model.institutions).some(i => i.practiceType === 'shopping');
      return model.step > 8 && hasShop && Math.random() < 0.18;
    },
    choices: [
      {
        label: 'Welcome trade (+material satisfaction, -community)',
        effect: (model) => {
          for (const agent of model.agents) {
            agent.materialSatisfaction = Math.min(1, agent.materialSatisfaction + 0.2);
            agent.values.community = Math.max(0, agent.values.community - 0.08);
            agent.moneyBudget += 200;
          }
          return 'Goods flow in. Local artisans feel marginalized.';
        }
      },
      {
        label: 'Protect local economy',
        effect: (model) => {
          for (const agent of model.agents) {
            agent.values.community = Math.min(1, agent.values.community + 0.1);
            agent.values.material = Math.max(0, agent.values.material - 0.05);
          }
          return 'Local crafts thrive. But prices stay high.';
        }
      },
    ]
  },
  
  {
    id: 'religious_revival',
    name: 'Religious Revival',
    description: 'A charismatic preacher is drawing crowds. Should you support or restrain?',
    trigger: (model) => {
      const hasChurch = Object.values(model.institutions).some(i => i.practiceType === 'church');
      const avgTradition = model.agents.reduce((s, a) => s + a.values.tradition, 0) / model.agents.length;
      return model.step > 12 && hasChurch && avgTradition > 0.4 && Math.random() < 0.15;
    },
    choices: [
      {
        label: 'Support the movement (+tradition, +community)',
        effect: (model) => {
          for (const agent of model.agents) {
            if (Math.random() < 0.7) {
              agent.values.tradition = Math.min(1, agent.values.tradition + 0.15);
              agent.values.community = Math.min(1, agent.values.community + 0.1);
            }
          }
          return 'Faith deepens. Social cohesion strengthens. Some secular folks feel excluded.';
        }
      },
      {
        label: 'Maintain separation of church and state',
        effect: (model) => {
          for (const agent of model.agents) {
            agent.values.civic = Math.min(1, agent.values.civic + 0.08);
            if (Math.random() < 0.3) {
              agent.values.tradition = Math.max(0, agent.values.tradition - 0.05);
            }
          }
          return 'Civic institutions remain neutral. Religious fervor dampens.';
        }
      },
    ]
  },
];

// Calculate overall societal metrics
export function calculateMetrics(model) {
  if (!model || !model.agents.length) return null;
  
  const n = model.agents.length;
  
  // Average values
  const avgValues = {};
  for (const key of Object.keys(model.agents[0].values)) {
    avgValues[key] = model.agents.reduce((s, a) => s + a.values[key], 0) / n;
  }
  
  // Average satisfaction
  const avgSatisfaction = model.agents.reduce((s, a) => s + (a.satisfaction || 0.5), 0) / n;
  
  // Wealth stats
  const avgWealth = model.agents.reduce((s, a) => s + a.moneyBudget, 0) / n;
  const wealths = model.agents.map(a => a.moneyBudget).sort((a, b) => a - b);
  const medianWealth = wealths[Math.floor(n / 2)];
  
  // Network density
  let totalConnections = 0;
  for (const neighbors of model.adjacency.values()) {
    totalConnections += neighbors.size;
  }
  const networkDensity = totalConnections / (n * 2);
  
  // Inequality (Gini approximation)
  const bottom20 = wealths.slice(0, Math.floor(n * 0.2));
  const top20 = wealths.slice(-Math.floor(n * 0.2));
  const avgBottom = bottom20.reduce((s, w) => s + w, 0) / bottom20.length;
  const avgTop = top20.reduce((s, w) => s + w, 0) / top20.length;
  const inequality = avgTop / Math.max(avgBottom, 100);
  
  return {
    avgValues,
    avgSatisfaction,
    avgWealth,
    medianWealth,
    networkDensity,
    inequality,
    population: n,
  };
}
