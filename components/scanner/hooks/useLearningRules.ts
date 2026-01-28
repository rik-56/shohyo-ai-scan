import { useState, useEffect, useCallback } from 'react';
import { LearningRulesMap, LearningRule } from '../../../types';

const STORAGE_PREFIX_RULES = 'kakeibo_ai_rules_';

export const useLearningRules = (
  selectedClient: string,
  onLearningRulesChange?: (clientName: string, rules: LearningRulesMap) => void
) => {
  const [learningRules, setLearningRules] = useState<LearningRulesMap>({});

  // Load learning rules when client changes
  useEffect(() => {
    if (!selectedClient) return;

    const storageKey = `${STORAGE_PREFIX_RULES}${selectedClient}`;
    const savedRules = localStorage.getItem(storageKey);

    if (savedRules) {
      try {
        const parsed = JSON.parse(savedRules);
        // Migrate old string format to new object format
        const migratedRules: LearningRulesMap = {};
        Object.entries(parsed).forEach(([key, val]) => {
          migratedRules[key] = typeof val === 'string'
            ? { kamoku: val, subKamoku: '' }
            : val as LearningRule;
        });
        setLearningRules(migratedRules);
      } catch (e) {
        console.error('Failed to parse rules from localStorage:', e);
        setLearningRules({});
        localStorage.setItem(storageKey, JSON.stringify({}));
      }
    } else {
      setLearningRules({});
    }
  }, [selectedClient]);

  // Update a learning rule
  const updateRule = useCallback((
    description: string,
    kamoku: string,
    subKamoku: string
  ) => {
    const newRule: LearningRule = { kamoku, subKamoku };
    const updatedRules = { ...learningRules, [description]: newRule };

    setLearningRules(updatedRules);
    localStorage.setItem(
      `${STORAGE_PREFIX_RULES}${selectedClient}`,
      JSON.stringify(updatedRules)
    );
    onLearningRulesChange?.(selectedClient, updatedRules);

    return updatedRules;
  }, [learningRules, selectedClient, onLearningRulesChange]);

  // Get rule for a specific description
  const getRule = useCallback((description: string): LearningRule | undefined => {
    return learningRules[description];
  }, [learningRules]);

  // Check if a rule exists and matches
  const hasMatchingRule = useCallback((description: string, kamoku: string): boolean => {
    const rule = learningRules[description];
    return !!(rule && rule.kamoku === kamoku);
  }, [learningRules]);

  return {
    learningRules,
    updateRule,
    getRule,
    hasMatchingRule
  };
};
