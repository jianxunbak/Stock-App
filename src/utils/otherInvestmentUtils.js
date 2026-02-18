/**
 * Calculates projection for Other Investments (combining items and groups).
 * Returns an array of objects: { year, date, age, value, invested }
 */
export const calculateOtherInvestmentProjection = ({
    data = { items: [], groups: [] },
    projectionYears = 10,
    currentAge = null,
    startYear = new Date().getFullYear()
}) => {
    // Normalize data into a flat list of items
    const allItems = [
        ...(data.items || []),
        ...(data.groups || []).flatMap(g => g.items || [])
    ];

    const projection = [];

    for (let y = 0; y <= projectionYears; y++) {
        const point = {
            year: startYear + y,
            date: currentAge !== null ? `Age ${currentAge + y}` : `Year ${y}`,
            age: currentAge !== null ? currentAge + y : null,
            value: 0,
            invested: 0
        };

        let totalVal = 0;
        let totalInvested = 0;

        allItems.forEach(item => {
            const initialVal = Number(item.value || 0);
            const payment = Number(item.paymentAmount || 0);
            const growthRate = Number(item.projectedGrowth || 0) / 100;

            // Determine annual contribution based on frequency
            let freq = 0;
            if (item.frequency === 'Monthly') freq = 12;
            else if (item.frequency === 'Quarterly') freq = 4;
            else if (item.frequency === 'Yearly') freq = 1;

            const annualContribution = payment * freq;

            // Total Invested: Initial + Cumulative Contributions
            // Assumes contributions start immediately and continue for 'y' years
            const itemInvested = initialVal + (annualContribution * y);
            totalInvested += itemInvested;

            // Projected Value: Future Value Formula
            // FV = P(1+r)^t + PMT * ((1+r)^t - 1)/r
            // If No Growth: Linear addition
            let itemValue = 0;
            if (growthRate === 0) {
                itemValue = initialVal + (annualContribution * y);
            } else {
                const p_term = initialVal * Math.pow(1 + growthRate, y);
                // PMT term (Annual Contribution treated as end-of-year or similar approximation matching standard FV)
                // Note: If contributions are monthly, technically we should compound monthly, 
                // but the card used an annual approximation with P/Y=1 for simplicity or P/Y=Freq.
                // The original code used: 
                // annualContribution * (Math.pow(1 + growthRate, y) - 1) / growthRate;
                // This formula treats 'annualContribution' as the PMT and 'growthRate' as the rate per period (year).
                // This is a standard approximation for "annual compounding with annual total contribution".

                const pmt_term = annualContribution * (Math.pow(1 + growthRate, y) - 1) / growthRate;
                itemValue = p_term + pmt_term;
            }
            totalVal += itemValue;
        });

        point.value = Math.round(totalVal);
        point.invested = Math.round(totalInvested);
        projection.push(point);
    }

    return projection;
};

// Helper to normalize input if needed (optional)
export const normalizeOtherInvestments = (data) => {
    if (!data) return { items: [], groups: [] };
    const sourceData = Array.isArray(data) ? { items: data, groups: [] } : data;
    return sourceData;
};
