const { calculateCPFProjection } = require('./src/utils/cpfUtils.js');

const result = calculateCPFProjection({
    currentAge: 30,
    dateOfBirth: '1996-01-01', // Should be 30 in 2026
    monthlySalary: 6000,
    annualBonus: 12000,
    salaryGrowth: 0,
    projectionYears: 30,
    balances: { oa: 0, sa: 0, ma: 0, ra: 0 }
});

console.log('Result at age 60:', result.projection[30].total.toLocaleString());
console.log('Final Balances:', result.finalBalances);
