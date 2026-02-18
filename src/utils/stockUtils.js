/**
 * Calculates simulated stock growth based on scenarios.
 * 
 * @param {Object} params
 * @param {Array} params.charts - List of charts, each containing scenarios.
 * @param {number} params.projectionYears - Number of years to project.
 * @param {number|null} params.currentAge - Current age of the user (for labeling).
 * @param {number} params.startYear - Starting year for projection (default: current year).
 * @returns {Array} Array of year-by-year data points with consolidated and per-scenario values.
 */
export const calculateStockProjection = ({
    charts = [],
    projectionYears = 30,
    currentAge = null,
    startYear = new Date().getFullYear()
}) => {
    const data = [];

    // Filter for visible charts and scenarios
    const activeCharts = charts.filter(c => c.visible !== false);

    for (let year = 0; year <= projectionYears; year++) {
        const yearNum = startYear + year;
        const ageLabel = currentAge !== null ? currentAge + year : undefined;
        const label = currentAge !== null ? `Age ${ageLabel}` : `Year ${year}`;

        const point = {
            year: yearNum,
            age: ageLabel,
            date: label,
            totalValue: 0,
            totalInvested: 0,
            totalGains: 0
        };

        activeCharts.forEach(chart => {
            const visibleScenarios = (chart.scenarios || []).filter(s => s.visible !== false);

            visibleScenarios.forEach(scenario => {
                const estimatedRate = Number(scenario.estimatedRate || 0);
                const initialDeposit = Number(scenario.initialDeposit || 0);
                const contributionAmount = Number(scenario.contributionAmount || 0);

                const annualRate = estimatedRate / 100;
                const freq = scenario.contributionFrequency === 'monthly' ? 12 :
                    scenario.contributionFrequency === 'quarterly' ? 4 : 1;

                const annualContribution = contributionAmount * freq;

                // Invested: Initial + (Annual * Years)
                let totalInvested = initialDeposit + (annualContribution * year);

                // Value: FV = P(1+r)^t + PMT * ((1+r)^t - 1)/r (Ordinary Annuity)
                let totalValue = 0;
                if (annualRate === 0) {
                    totalValue = totalInvested;
                } else {
                    const p_term = initialDeposit * Math.pow(1 + annualRate, year);
                    const pmt_term = annualContribution * (Math.pow(1 + annualRate, year) - 1) / annualRate;
                    totalValue = p_term + pmt_term;
                }

                totalInvested = Math.round(totalInvested * 100) / 100;
                totalValue = Math.round(totalValue * 100) / 100;

                // Store per-scenario data (using unique ID assumption: chartId_scenarioId or just scenarioId if unique globally? 
                // In StocksCard, scenario IDs seem unique per chart but maybe not globally. 
                // StocksCard used `value_${scenario.id}`. We will stick to that schema for compatibility.)
                point[`invested_${scenario.id}`] = totalInvested;
                point[`value_${scenario.id}`] = totalValue;

                // Accumulate totals
                point.totalValue += totalValue;
                point.totalInvested += totalInvested;
            });
        });

        point.totalGains = point.totalValue - point.totalInvested;
        data.push(point);
    }

    return data;
};
