import React from 'react';

interface Transaction {
  transaction_id: number;
  transaction_name: string;
  entity_id: number;
  status: string;
}

interface TransactionSelectorProps {
  transactions: Transaction[];
  selectedTransaction: number | null;
  onTransactionChange: (transactionId: number | null) => void;
}

export const TransactionSelector: React.FC<TransactionSelectorProps> = ({
  transactions,
  selectedTransaction,
  onTransactionChange
}) => {
  const handleTransactionChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    onTransactionChange(value ? Number(value) : null);
  };

  const getStatusColor = (status: string): string => {
    switch (status.toLowerCase()) {
      case 'active':
      case 'open':
        return '#52c41a';
      case 'pending':
      case 'in progress':
        return '#1890ff';
      case 'completed':
      case 'closed':
        return '#8c8c8c';
      case 'cancelled':
      case 'failed':
        return '#ff4d4f';
      default:
        return '#8c8c8c';
    }
  };

  return (
    <div className="transaction-selector">
      <select
        className="form-select"
        value={selectedTransaction || ''}
        onChange={handleTransactionChange}
      >
        <option value="">Select a transaction (optional)...</option>
        {transactions.map((transaction) => (
          <option key={transaction.transaction_id} value={transaction.transaction_id}>
            {transaction.transaction_name} ({transaction.status})
          </option>
        ))}
      </select>
      
      {selectedTransaction && (
        <div className="selected-transaction-info">
          <p>
            <strong>Selected:</strong> {
              transactions.find(t => t.transaction_id === selectedTransaction)?.transaction_name
            }
            <span 
              style={{ 
                color: getStatusColor(
                  transactions.find(t => t.transaction_id === selectedTransaction)?.status || ''
                ),
                marginLeft: '8px'
              }}
            >
              ({transactions.find(t => t.transaction_id === selectedTransaction)?.status})
            </span>
          </p>
        </div>
      )}
      
      {transactions.length === 0 && (
        <div className="empty-state">
          <p>No transactions available for this entity.</p>
        </div>
      )}
    </div>
  );
};
