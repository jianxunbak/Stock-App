
const getSpecificRates = (age) => {
    if (age <= 35) return { oa: 0.2300, sa: 0.0600, ma: 0.0800, total: 0.3700 };
    if (age <= 45) return { oa: 0.2101, sa: 0.0699, ma: 0.0900, total: 0.3700 };
    if (age <= 50) return { oa: 0.1901, sa: 0.0799, ma: 0.1000, total: 0.3700 };
    if (age <= 55) return { oa: 0.1501, sa: 0.1149, ma: 0.1050, total: 0.3700 };
    if (age <= 60) return { oa: 0.1150, sa: 0.1100, ma: 0.1000, total: 0.3250 };
    return { oa: 0.0100, sa: 0.0100, ma: 0.1050, total: 0.1250 };
};

const calculateCPFProjection = ({
    currentAge = 30,
    monthlySalary = 6000,
    annualBonus = 12000,
    salaryGrowth = 0,
    projectionYears = 30,
    balances = { oa: 0, sa: 0, ma: 0, ra: 0 }
}) => {
    const startYear = 2026;
    let bal = { ...balances };
    const maxYears = projectionYears;

    for (let y = 0; y < maxYears; y++) {
        const year = startYear + y;
        let pendingInterest = { oa: 0, sa: 0, ma: 0, ra: 0 };
        let totalWagesYearToDate = 0;

        for (let m = 0; m < 12; m++) {
            const lookupAge = currentAge + y;
            const rates = getSpecificRates(lookupAge);
            const ow = Math.min(monthlySalary, 8000);
            const aw = (m === 11) ? annualBonus : 0;
            const potentialSubject = ow + aw;
            const actualSubject = Math.min(potentialSubject, 102000 - totalWagesYearToDate);
            totalWagesYearToDate += actualSubject;

            // Interest (Opening)
            pendingInterest.oa += bal.oa * (0.025 / 12);
            pendingInterest.sa += bal.sa * (0.04 / 12);
            pendingInterest.ma += bal.ma * (0.04 / 12);

            // Extra 1%
            let extraBase = 60000;
            const maQual = Math.min(bal.ma, extraBase); extraBase -= maQual;
            const saQual = Math.min(bal.sa, extraBase); extraBase -= saQual;
            const oaQual = Math.min(bal.oa, extraBase, 20000);

            pendingInterest.sa += (saQual + maQual + oaQual) * (0.01 / 12); // Simplified crediting to SA

            // Contribution
            bal.oa += actualSubject * rates.oa;
            bal.sa += actualSubject * rates.sa;
            bal.ma += actualSubject * rates.ma;

            // Overflow
            const bhs = 79000 * Math.pow(1.03, y);
            if (bal.ma > bhs) {
                const excess = bal.ma - bhs;
                bal.ma = bhs;
                bal.sa += excess;
            }
        }
        bal.oa += pendingInterest.oa;
        bal.sa += pendingInterest.sa;
        bal.ma += pendingInterest.ma;
    }
    return bal;
};

const res = calculateCPFProjection({
    currentAge: 30,
    monthlySalary: 6000,
    annualBonus: 12000,
    salaryGrowth: 0,
    projectionYears: 30,
    balances: { oa: 0, sa: 0, ma: 0, ra: 0 }
});

console.log('Total at 60:', (res.oa + res.sa + res.ma).toLocaleString());
