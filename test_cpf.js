
const YEAR_CONFIGS = {
    2026: { owCeiling: 8000, annualLimit: 102000 },
};

const getYearlyConfig = (year) => {
    return YEAR_CONFIGS[2026];
};

const getSpecificRates = (age) => {
    if (age <= 35) return { oa: 0.2300, sa: 0.0600, ma: 0.0800, total: 0.3700 };
    if (age <= 45) return { oa: 0.2101, sa: 0.0699, ma: 0.0900, total: 0.3700 };
    if (age <= 50) return { oa: 0.1901, sa: 0.0799, ma: 0.1000, total: 0.3700 };
    if (age <= 55) return { oa: 0.1501, sa: 0.1149, ma: 0.1050, total: 0.3700 };
    if (age <= 60) return { oa: 0.1150, sa: 0.1100, ma: 0.1000, total: 0.3250 };
    if (age <= 65) return { oa: 0.0450, sa: 0.0950, ma: 0.1100, total: 0.2500 };
    if (age <= 70) return { oa: 0.0200, sa: 0.0600, ma: 0.0850, total: 0.1650 };
    return { oa: 0.0100, sa: 0.0100, ma: 0.1050, total: 0.1250 };
};

const calculateCPFProjection = ({
    currentAge = 30,
    dateOfBirth = null,
    monthlySalary = 6000,
    annualBonus = 12000,
    salaryGrowth = 0,
    projectionYears = 30,
    balances = { oa: 0, sa: 0, ma: 0, ra: 0 }
}) => {
    const startYear = 2026;
    const birthMonthIndex = dateOfBirth ? new Date(dateOfBirth).getMonth() : 0;
    let bal = {
        oa: Number(balances.oa || 0),
        sa: Number(balances.sa || 0),
        ma: Number(balances.ma || 0),
        ra: Number(balances.ra || 0)
    };
    let projection = [];
    for (let y = 0; y < projectionYears; y++) {
        const year = startYear + y + 1;
        const config = getYearlyConfig(year);
        const annualWageCeiling = config.annualLimit || 102000;
        let pendingInterest = { oa: 0, sa: 0, ma: 0, ra: 0 };
        let totalWagesYearToDate = 0;
        for (let m = 0; m < 12; m++) {
            const lookupAge = (m > birthMonthIndex) ? currentAge + 1 : currentAge;
            const rates = getSpecificRates(lookupAge);
            const growthFactor = Math.pow(1 + (Number(salaryGrowth) / 100), y);
            const currentMonthlySalary = Number(monthlySalary || 0) * growthFactor;
            const currentAnnualBonus = Number(annualBonus || 0) * growthFactor;
            const ow = Math.min(currentMonthlySalary, config.owCeiling);
            const aw = (m === 11) ? currentAnnualBonus : 0;
            const actualSubject = Math.min(ow + aw, Math.max(0, annualWageCeiling - totalWagesYearToDate));
            totalWagesYearToDate += actualSubject;
            bal.oa += actualSubject * rates.oa;
            bal.sa += actualSubject * rates.sa;
            bal.ma += actualSubject * rates.ma;

            // Interest calculation
            pendingInterest.oa += bal.oa * (0.025 / 12);
            pendingInterest.sa += bal.sa * (0.04 / 12);
            pendingInterest.ma += bal.ma * (0.04 / 12);
            pendingInterest.ra += bal.ra * (0.04 / 12);

            // Side logic (overflow/extra) omitted for brevity in trace if not needed, 
            // but let's include extra interest as it's significant.
            let extraBase = 60000;
            let extraInterest = 0;
            const maQualify = Math.min(bal.ma, extraBase);
            extraBase -= maQualify;
            extraInterest += maQualify * (0.01 / 12);
            const saRaBal = (currentAge < 55) ? bal.sa : bal.ra;
            const saQualify = Math.min(saRaBal, extraBase);
            extraBase -= saQualify;
            extraInterest += saQualify * (0.01 / 12);
            const oaQualify = Math.min(bal.oa, Math.min(extraBase, 20000));
            extraInterest += oaQualify * (0.01 / 12);
            if (currentAge < 55) pendingInterest.sa += extraInterest;
            else pendingInterest.ra += extraInterest;
        }
        bal.oa += pendingInterest.oa;
        bal.sa += pendingInterest.sa;
        bal.ma += pendingInterest.ma;
        bal.ra += pendingInterest.ra;

        // MA overflow
        const currentBHS = 79000 * Math.pow(1.03, year - 2026);
        if (bal.ma > currentBHS) {
            const excess = bal.ma - currentBHS;
            bal.ma = currentBHS;
            bal.sa += excess; // Simplified overflow
        }
        currentAge++;
    }
    return bal;
};

const userBalances = {
    oa: 25805.47,
    sa: 123922.99 + 90245.70, // Assuming CPFIS is in SA
    ma: 47250.04,
    ra: 0
};

// Test with salary = 6000, bonus = 12000 (app defaults)
console.log("--- Test 1: Salary 6000, Bonus 12000 ---");
const res1 = calculateCPFProjection({
    currentAge: 37,
    projectionYears: 18,
    monthlySalary: 6000,
    annualBonus: 12000,
    balances: userBalances
});
console.log("Total at 55:", res1.oa + res1.sa + res1.ma + res1.ra);

// Test with salary = 0 (Just growth of current balances)
console.log("\n--- Test 2: Salary 0 (Just interest) ---");
const res2 = calculateCPFProjection({
    currentAge: 37,
    projectionYears: 18,
    monthlySalary: 0,
    annualBonus: 0,
    balances: userBalances
});
console.log("Total at 55:", res2.oa + res2.sa + res2.ma + res2.ra);

// Test with POSB's expected total: what salary leads to 1.14M?
// Let's try 8000 salary, 16000 bonus (approx matching a $100k+ income)
console.log("\n--- Test 3: Salary 9000, Bonus 18000 ---");
const res3 = calculateCPFProjection({
    currentAge: 37,
    projectionYears: 18,
    monthlySalary: 9000,
    annualBonus: 18000,
    balances: userBalances
});
console.log("Total at 55:", res3.oa + res3.sa + res3.ma + res3.ra);
