/**
 * Shared CPF Calculation Utilities
 * Used by CPFCard (for detailed breakdown) and WealthSummaryCard (for Net Worth projection).
 */

// --- CPF 2026+ Base Logic Helpers ---
const YEAR_CONFIGS = {
    2024: { owCeiling: 6300, annualLimit: 102000 },
    2025: { owCeiling: 7000, annualLimit: 102000 },
    2026: { owCeiling: 8000, annualLimit: 102000 },
};

const getYearlyConfig = (year) => {
    if (year <= 2024) return YEAR_CONFIGS[2024];
    if (year === 2025) return YEAR_CONFIGS[2025];
    return YEAR_CONFIGS[2026];
};

// Helper to get exact OA/SA/MA rates based on age
const getSpecificRates = (age) => {
    // <= 35 (Standard 2026: 23, 6, 8 => Total 37%) 
    if (age <= 35) return { oa: 0.2300, sa: 0.0600, ma: 0.0800, total: 0.3700 };

    // 35-45 (User Rule: 21.01, 6.99, 9.0 => Total 37%)
    if (age <= 45) return { oa: 0.2101, sa: 0.0699, ma: 0.0900, total: 0.3700 };

    // 45-50 (User Rule: 19.01, 7.99, 10.0 => Total 37%)
    if (age <= 50) return { oa: 0.1901, sa: 0.0799, ma: 0.1000, total: 0.3700 };

    // 50-55 (User Rule: 15.01, 11.49, 10.5 => Total 37%)
    if (age <= 55) return { oa: 0.1501, sa: 0.1149, ma: 0.1050, total: 0.3700 };

    // > 55 (Standard tapering - approximate based on 2026)
    if (age <= 60) return { oa: 0.1150, sa: 0.1100, ma: 0.1000, total: 0.3250 };
    if (age <= 65) return { oa: 0.0450, sa: 0.0950, ma: 0.1100, total: 0.2500 };
    if (age <= 70) return { oa: 0.0200, sa: 0.0600, ma: 0.0850, total: 0.1650 };
    return { oa: 0.0100, sa: 0.0100, ma: 0.1050, total: 0.1250 };
};

/**
 * Calculates the CPF projection based on inputs.
 * 
 * @param {Object} params - Input parameters
 * @param {number} params.currentAge - Current age of the user
 * @param {string|Date} params.dateOfBirth - User's date of birth (used to determine exact month for age transitions)
 * @param {number} params.monthlySalary - Monthly salary
 * @param {number} params.annualBonus - Annual bonus
 * @param {number} params.salaryGrowth - Annual salary growth percentage
 * @param {number} params.projectionYears - Number of years to project
 * @param {Object} params.balances - Initial balances { oa, sa, ma, ra }
 * 
 * @returns {Object} Result logic containing projection array, yearlyInterest, finalBalances, at55 snapshot
 */
export const calculateCPFProjection = ({
    currentAge = 30,
    dateOfBirth = null,
    monthlySalary = 6000,
    annualBonus = 12000,
    salaryGrowth = 0,
    projectionYears = 30,
    balances = { oa: 0, sa: 0, ma: 0, ra: 0 },
    cpfisData = { items: [], groups: [] }
}) => {
    const today = new Date();
    const startYear = today.getFullYear();
    const startMonthIndex = today.getMonth();
    const birthMonthIndex = dateOfBirth ? new Date(dateOfBirth).getMonth() : 0;

    let at55Snapshot = { withdrawable: 0, ra: 0, target: 0, ageReached: false };

    // Normalize CPFIS Items
    const cpisItems = [
        ...(cpfisData.items || []),
        ...(cpfisData.groups || []).flatMap(g => g.items || [])
    ].map(item => ({
        ...item,
        currentValue: Number(item.value || 0),
        investedAmount: Number(item.investedAmount || item.value || 0),
        growthRate: Number(item.projectedGrowth || 0) / 100,
        monthlyPayment: (() => {
            const pay = Number(item.paymentAmount || 0);
            if (item.frequency === 'Yearly') return pay / 12;
            if (item.frequency === 'Quarterly') return pay / 3;
            if (item.frequency === 'Monthly') return pay;
            return 0;
        })()
    }));

    // Normalize balances
    let bal = {
        oa: Number(balances.oa || 0),
        sa: Number(balances.sa || 0),
        ma: Number(balances.ma || 0),
        ra: Number(balances.ra || 0)
    };

    const currentTotal = bal.oa + bal.sa + bal.ma + bal.ra;

    let projection = [];
    let yearlyInterest = { total: 0, breakdown: { oa: 0, sa: 0, ma: 0, ra: 0 } };

    const initialCpfisTotal = cpisItems.reduce((sum, item) => sum + item.currentValue, 0);

    // Initial State (Year 0 / Start)
    projection.push({
        year: startYear,
        age: currentAge,
        oa: bal.oa,
        sa_ra: bal.sa + bal.ra,
        ma: bal.ma,
        cpfis: initialCpfisTotal,
        total: bal.oa + bal.sa + bal.ma + bal.ra + initialCpfisTotal
    });

    const maxYears = Math.min(Number(projectionYears), 100 - currentAge);

    // Simulation Loop
    for (let y = 0; y < maxYears; y++) {
        const year = startYear + y;
        const config = getYearlyConfig(year);
        const annualWageCeiling = config.annualLimit || 102000;

        let pendingInterest = { oa: 0, sa: 0, ma: 0, ra: 0 };
        let totalWagesYearToDate = 0;

        // For the first year, start from the current month
        const monthStart = y === 0 ? startMonthIndex : 0;

        for (let m = monthStart; m < 12; m++) {
            const isPostBday = m > birthMonthIndex;
            const lookupAge = isPostBday ? currentAge + 1 : currentAge;

            // Step 3: Get specific rates for this age
            const rates = getSpecificRates(lookupAge);

            // Apply Salary Growth Logic
            const growthFactor = Math.pow(1 + (Number(salaryGrowth) / 100), y);
            const currentMonthlySalary = Number(monthlySalary || 0) * growthFactor;
            const currentAnnualBonus = Number(annualBonus || 0) * growthFactor;

            const sNum = currentMonthlySalary;

            // --- CPFIS Growth & Contributions ---
            let monthlyCpfisInvestment = 0;
            cpisItems.forEach(item => {
                // Growth
                const monthlyGrowth = Math.pow(1 + item.growthRate, 1 / 12) - 1;
                item.currentValue *= (1 + monthlyGrowth);

                // Contribution (only if enough OA)
                if (item.monthlyPayment > 0) {
                    const toInvest = Math.min(bal.oa, item.monthlyPayment);
                    bal.oa -= toInvest;
                    item.currentValue += toInvest;
                    item.investedAmount += toInvest;
                    monthlyCpfisInvestment += toInvest;
                }
            });

            // Rule 1: Monthly Wage Ceiling (OW)
            const ow = Math.min(sNum, config.owCeiling);

            const isBonus = m === 11;
            const bNum = currentAnnualBonus;
            const aw = isBonus ? bNum : 0;

            const potentialSubject = ow + aw;

            // Rule 2: Annual Ceiling Logic
            const remainingQuota = Math.max(0, annualWageCeiling - totalWagesYearToDate);
            const actualSubject = Math.min(potentialSubject, remainingQuota);

            totalWagesYearToDate += actualSubject;

            // --- Step 4: Interest Calculation (Before Monthly Contribution) ---
            // CPF Rule: Interest is based on the opening balance of the month.
            // In our logic, bal.oa already had CPFIS investments deducted, so it's the "cash" part.
            pendingInterest.oa += bal.oa * (0.025 / 12);
            pendingInterest.sa += bal.sa * (0.04 / 12);
            pendingInterest.ma += bal.ma * (0.04 / 12);
            pendingInterest.ra += bal.ra * (0.04 / 12);

            // Step 4b: Extra Interest Hierarchy (Before Contribution)
            // Rule: First $60k combined (up to $20k from OA) gets +1%.
            // Age 55+: First $30k combined gets an additional +1% (Total +2% on first $30k).
            let extra1_60k = 60000;
            let extra1_30k = (lookupAge >= 55) ? 30000 : 0;

            const calculateExtraOnAccount = (accountName, balance) => {
                const effectiveBalance = accountName === 'oa' ? Math.min(balance, 20000) : balance;

                // Tier 1: Additional 1% for 55+ on first $30k
                let tier1Qualify = 0;
                if (extra1_30k > 0) {
                    tier1Qualify = Math.min(effectiveBalance, extra1_30k);
                    extra1_30k -= tier1Qualify;
                }

                // Tier 2: Standard 1% on first $60k
                const remainingForTier2 = Math.min(effectiveBalance, extra1_60k);
                const tier2Qualify = Math.min(remainingForTier2, extra1_60k);
                extra1_60k -= tier2Qualify;

                return (tier1Qualify * (0.01 / 12)) + (tier2Qualify * (0.01 / 12));
            };

            // Order of priority: RA > MA > SA > OA
            if (lookupAge >= 55) {
                pendingInterest.ra += calculateExtraOnAccount('ra', bal.ra);
            }
            pendingInterest.ma += calculateExtraOnAccount('ma', bal.ma);
            if (lookupAge < 55) {
                pendingInterest.sa += calculateExtraOnAccount('sa', bal.sa);
            }

            // Extra interest earned on OA goes to SA (or RA if 55+)
            const extraFromOA = calculateExtraOnAccount('oa', bal.oa);
            if (lookupAge < 55) {
                pendingInterest.sa += extraFromOA;
            } else {
                pendingInterest.ra += extraFromOA;
            }

            // --- Step 5: Add Contributions ---
            const contribOA = actualSubject * rates.oa;
            const contribSA = actualSubject * rates.sa;
            const contribMA = actualSubject * rates.ma;

            bal.oa += contribOA;
            bal.sa += contribSA;
            bal.ma += contribMA;

            // --- Step 6: MediSave Overflow Check (Monthly) ---
            // Current BHS (2024 is $71.5k, extrapolating to startYear with 3% growth)
            const baseBHS = 71500 * Math.pow(1.03, startYear - 2024);
            const currentBHS = baseBHS * Math.pow(1.03, y);

            // Current FRS (2025 is $213k, extrapolating with 3.5% growth)
            const baseFRS = 213000 * Math.pow(1.035, startYear - 2025);
            const currentFRS = baseFRS * Math.pow(1.035, y);

            const handleOverflow = () => {
                if (bal.ma > currentBHS) {
                    const excessMA = bal.ma - currentBHS;
                    bal.ma = currentBHS;

                    // Overflow to SA (or RA if age >= 55)
                    if (currentAge < 55) {
                        if (bal.sa + excessMA > currentFRS) {
                            const spaceInSA = Math.max(0, currentFRS - bal.sa);
                            bal.sa += spaceInSA;
                            const remainingExcess = excessMA - spaceInSA;
                            bal.oa += remainingExcess;
                        } else {
                            bal.sa += excessMA;
                        }
                    } else {
                        const currentERS = currentFRS * 2; // ERS is usually 2x FRS? No, 3x FRS now, 4x in 2025
                        const erMultiplier = year >= 2025 ? 4 : 3;
                        const brs = currentFRS / 2;
                        const ers = brs * erMultiplier;

                        if (bal.ra + excessMA > ers) {
                            const spaceInRA = Math.max(0, ers - bal.ra);
                            bal.ra += spaceInRA;
                            const remainingExcess = excessMA - spaceInRA;
                            bal.oa += remainingExcess;
                        } else {
                            bal.ra += excessMA;
                        }
                    }
                }
            };

            handleOverflow();

            // --- Step 6: Age 55 Retirement Transition ---
            if (lookupAge === 55 && m === birthMonthIndex) {
                const projectedFRS = baseFRS * Math.pow(1.035, (startYear + y) - 2025);

                // Transfer SA -> RA
                const spaceInRA = Math.max(0, projectedFRS - bal.ra);
                const fromSA = Math.min(bal.sa, spaceInRA);
                bal.ra += fromSA;
                bal.sa -= fromSA;

                // Transfer OA -> RA
                const remainingSpaceInRA = Math.max(0, projectedFRS - bal.ra);
                const fromOA = Math.min(bal.oa, remainingSpaceInRA);
                bal.ra += fromOA;
                bal.oa -= fromOA;

                // SA Closure
                if (bal.sa > 0) {
                    bal.oa += bal.sa;
                    bal.sa = 0;
                }

                at55Snapshot = {
                    withdrawable: bal.oa,
                    ra: bal.ra,
                    target: projectedFRS,
                    ageReached: true
                };
            }

            // --- Step 6b: Future SA Contributions Redirect (Age >= 55) ---
            const isAfter55 = (currentAge > 55) || (currentAge === 55 && m > birthMonthIndex);
            if (isAfter55 && bal.sa > 0) {
                const amount = bal.sa;
                bal.sa = 0;

                const currentERS = 440800 * Math.pow(1.035, year - 2026);
                const spaceInRA = Math.max(0, currentERS - bal.ra);
                const toRA = Math.min(amount, spaceInRA);
                bal.ra += toRA;

                const toOA = amount - toRA;
                bal.oa += toOA;
            }
        }

        bal.oa += pendingInterest.oa;
        bal.sa += pendingInterest.sa;
        bal.ma += pendingInterest.ma;
        bal.ra += pendingInterest.ra;

        // Re-apply overflow check after year-end interest
        const currentBHS_YE = 79000 * Math.pow(1.03, year - 2026);
        const currentFRS_YE = 213000 * Math.pow(1.03, year - 2026);

        if (bal.ma > currentBHS_YE) {
            const excessMA = bal.ma - currentBHS_YE;
            bal.ma = currentBHS_YE;

            if (currentAge < 55) {
                if (bal.sa + excessMA > currentFRS_YE) {
                    const spaceInSA = Math.max(0, currentFRS_YE - bal.sa);
                    bal.sa += spaceInSA;
                    const remaining = excessMA - spaceInSA;
                    bal.oa += remaining;
                } else {
                    bal.sa += excessMA;
                }
            } else {
                const currentERS_YE = 426000 * Math.pow(1.03, year - 2026);
                if (bal.ra + excessMA > currentERS_YE) {
                    const spaceInRA = Math.max(0, currentERS_YE - bal.ra);
                    bal.ra += spaceInRA;
                    const remaining = excessMA - spaceInRA;
                    bal.oa += remaining;
                } else {
                    bal.ra += excessMA;
                }
            }
        }

        currentAge++;

        const currentCpfisTotal = cpisItems.reduce((sum, item) => sum + item.currentValue, 0);

        projection.push({
            year: year,
            age: currentAge,
            oa: bal.oa,
            sa_ra: bal.sa + bal.ra,
            ma: bal.ma,
            cpfis: currentCpfisTotal,
            total: bal.oa + bal.sa + bal.ma + bal.ra + currentCpfisTotal
        });

        if (y === 0) {
            yearlyInterest = {
                total: pendingInterest.oa + pendingInterest.sa + pendingInterest.ma + pendingInterest.ra,
                breakdown: { ...pendingInterest }
            };
        }
    }

    return {
        projection,
        yearlyInterest,
        finalBalances: {
            oa: bal.oa,
            sa: bal.sa,
            ma: bal.ma,
            ra: bal.ra,
            cpfis: cpisItems.reduce((sum, item) => sum + item.currentValue, 0)
        },
        at55: at55Snapshot
    };
};
