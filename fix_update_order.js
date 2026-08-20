const fs = require('fs');

const path = 'frontend/src/components/EditOrderModal.jsx';
let content = fs.readFileSync(path, 'utf8');

const startIndex = content.indexOf('  const handleUpdateOrder = async () => {');
const endIndex = content.indexOf('  return (', startIndex);

if (startIndex === -1 || endIndex === -1) {
  console.log("Could not find handleUpdateOrder bounds.");
  process.exit(1);
}

const before = content.substring(0, startIndex);
const after = content.substring(endIndex);

const newHandle = `  const handleUpdateOrder = async () => {
    const finalPrice = isPendingTrigger && isMarket ? 0 : parseFloat(price);
    const sl = slPrice ? parseFloat(slPrice) : null;
    const tgt = tgtPrice ? parseFloat(tgtPrice) : null;
    const marketFlag = isPendingTrigger ? isMarket : false;

    const success = await updateOrder(order.id, quantity, finalPrice, sl, tgt, marketFlag);

    if (success) {
      closeEditOrderModal();
    } else {
      alert("Failed to update order. Please check your balance or parameters.");
    }
  };

`;

fs.writeFileSync(path, before + newHandle + after);
console.log("File updated successfully.");
