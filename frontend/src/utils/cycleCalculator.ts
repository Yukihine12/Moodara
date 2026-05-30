export interface Cycle {
  id: string;
  user_id: string;
  start_date: string;
  end_date: string | null;
  cycle_length: number | null;
  period_duration: number | null;
  notes?: string | null;
}

export interface CyclePrediction {
  next_period_date: string;
  ovulation_date: string;
  ovulation_window: string[];
  current_cycle_day: number;
  days_until_period: number;
}

// Simple date helpers
export const addDays = (date: Date | string, days: number): Date => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};

export const subDays = (date: Date | string, days: number): Date => {
  const d = new Date(date);
  d.setDate(d.getDate() - days);
  return d;
};

export const differenceInDays = (d1: Date | string, d2: Date | string): number => {
  const parseLocalDate = (d: Date | string): Date => {
    if (typeof d === 'string') {
      const parts = d.split('T')[0].split('-');
      if (parts.length === 3) {
        return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      }
    }
    const dateObj = new Date(d);
    return new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
  };

  const date1 = parseLocalDate(d1);
  const date2 = parseLocalDate(d2);
  const diffTime = date1.getTime() - date2.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
};

export const formatDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export class CycleCalculator {
  static predictNextCycle(
    cycles: Cycle[],
    defaultLength: number = 28,
    lastPeriodDate: string
  ): CyclePrediction {
    const today = new Date();
    const todayStr = formatDate(today);

    const validCycles = cycles
      .filter((c) => c.cycle_length !== null)
      .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());

    let cycleLength = defaultLength;

    if (validCycles.length > 0) {
      const recent = validCycles.slice(-6);
      let weightedSum = 0;
      let totalWeight = 0;
      
      recent.forEach((cycle, index) => {
        const weight = index + 1;
        weightedSum += (cycle.cycle_length || defaultLength) * weight;
        totalWeight += weight;
      });

      cycleLength = Math.round(weightedSum / totalWeight);
    }

    let lastStartStr = lastPeriodDate;
    const sortedAllCycles = [...cycles].sort(
      (a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
    );

    if (sortedAllCycles.length > 0) {
      lastStartStr = sortedAllCycles[sortedAllCycles.length - 1].start_date;
    }

    const lastStart = new Date(lastStartStr);
    const nextPeriod = addDays(lastStart, cycleLength);
    const nextPeriodStr = formatDate(nextPeriod);

    const ovulation = subDays(nextPeriod, 14);
    const ovulationStr = formatDate(ovulation);

    const ovulationWindow: string[] = [];
    for (let i = -2; i <= 2; i++) {
      ovulationWindow.push(formatDate(addDays(ovulation, i)));
    }

    const currentCycleDay = differenceInDays(todayStr, lastStartStr) + 1;
    const daysUntilPeriod = differenceInDays(nextPeriodStr, todayStr);

    return {
      next_period_date: nextPeriodStr,
      ovulation_date: ovulationStr,
      ovulation_window: ovulationWindow,
      current_cycle_day: currentCycleDay > 0 ? currentCycleDay : 1,
      days_until_period: daysUntilPeriod
    };
  }

  static calculatePhaseForDate(
    targetDateStr: string,
    cycles: Cycle[],
    prediction: CyclePrediction,
    avgPeriodDuration: number = 5
  ): 'menstruation' | 'follicular' | 'ovulation' | 'luteal' {
    const targetDate = new Date(targetDateStr);

    for (const cycle of cycles) {
      const start = new Date(cycle.start_date);
      const end = cycle.end_date 
        ? new Date(cycle.end_date) 
        : addDays(start, avgPeriodDuration - 1);

      if (targetDate >= start && targetDate <= end) {
        return 'menstruation';
      }
    }

    const predPeriodStart = new Date(prediction.next_period_date);
    const predPeriodEnd = addDays(predPeriodStart, avgPeriodDuration - 1);
    if (targetDate >= predPeriodStart && targetDate <= predPeriodEnd) {
      return 'menstruation';
    }

    if (prediction.ovulation_window.includes(targetDateStr)) {
      return 'ovulation';
    }

    const pastCycles = cycles
      .filter((c) => new Date(c.start_date) <= targetDate)
      .sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime());

    if (pastCycles.length === 0) {
      return 'follicular';
    }

    const targetOvulationDate = new Date(prediction.ovulation_date);
    if (targetDate < targetOvulationDate) {
      return 'follicular';
    } else {
      return 'luteal';
    }
  }
}
