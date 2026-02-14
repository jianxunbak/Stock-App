import React from 'react';
import FinancialStatementsTable from '../../ui/FinancialStatementsTable/FinancialStatementsTable';

/**
 * FinancialTables Card
 * 
 * A wrapper for the FinancialStatementsTable reusable component.
 * Positioned within the Analysis Page dashboard grid.
 */
const FinancialTables = (props) => {
    return (
        <FinancialStatementsTable
            {...props}
            title="Financial Statements"
        />
    );
};

export default FinancialTables;
