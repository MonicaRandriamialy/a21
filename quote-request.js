// Start by ensuring that the Wized JS API has initialised has loaded before executing our code.
window.Wized = window.Wized || [];
window.Wized.push(async (Wized) => {
  // The function expects an identifier of the request that can be either the Request ID or the Request name.
  // Returns a Promise that resolves when the request has finished.
  const result = await Wized.requests.waitFor('get_product');

  // Wized JS API initialised and the Request is complete. Time for Bolt code.
  // As long as the result is not null:
  if (result !== null) {

// State management
let cabinData = null;
let selectedCabin = null;
let editingBasketItemIndex = null;
let currentProductId = null;
const CHILD_DISCOUNT_AGE_RANGE = { min: 8, max: 11 };
const STORAGE_KEY = 'bookingBasket';

// Function to sync basket data with Wized Data Store
function syncWithWizedDataStore() {
    // Only proceed if Wized is available
    if (!window.Wized) return;

    const basket = getBasket();

    // Update Wized Data Store
    window.Wized.push((Wized) => {
        Wized.data.v.booking_basket_items = basket;
    });
}

// Price display template function
function getPriceDisplayTemplate() {
    return `
        <div>
            <div class="text-size-tiny">PRICE PER PERSON</div>
            <div class="heading-style-h4 text-weight-medium price-per-person">Select a Cabin</div>
        </div>
        <div>
            <div class="text-size-tiny">DISCOUNTS APPLIED</div>
            <div class="heading-style-h4 text-weight-medium discounts-applied">-</div>
        </div>
        <div>
            <div class="text-size-tiny">TOTAL CABIN PRICE</div>
            <div class="heading-style-h4 text-weight-medium total-price">-</div>
        </div>`;
}

// Cabin data mapping
const cabinDataMap = new Map();

// Basket management
function getBasket() {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
}

function saveBasket(basket) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(basket));
    syncWithWizedDataStore();
    renderMiniBasket();
}

function addToBasket() {
    // Prevent default form submission
    event.preventDefault();

    if (!selectedCabin) return;

    const warningContainer = document.querySelector('.warning-message');
    if (warningContainer) {
        warningContainer.remove();
    }

    const basket = getBasket();
    // Count cabins for current product
    const currentProductCabins = basket.filter(item => item.product_id === currentProductId).length;
    if (currentProductCabins >= 3 && editingBasketItemIndex === null) {
        const warning = document.createElement('div');
        warning.className = 'warning-message';
        warning.textContent = 'Maximum of 3 cabins allowed per booking';
        document.querySelector('.add-button').insertAdjacentElement('afterend', warning);
        return;
    }

    // First get all the values we need
    const adults = parseInt(document.getElementById('adults').value);
    const children = parseInt(document.getElementById('children').value) || 0;
    const occupancyType = document.getElementById('occupancyType').value;

    // Validate triple occupancy requirements
    if (occupancyType === 'triple') {
        const totalPeople = adults + children;
        if (totalPeople !== 3) {
            const warning = document.createElement('div');
            warning.className = 'warning-message';
            warning.textContent = 'Triple occupancy requires exactly 3 people';
            document.querySelector('.add-button').insertAdjacentElement('afterend', warning);
            return;
        }
    }
    
    // Validate quadruple occupancy requirements
    if (occupancyType === 'quadruple') {
        const totalPeople = adults + children;
        if (totalPeople !== 4) {
            const warning = document.createElement('div');
            warning.className = 'warning-message';
            warning.textContent = 'Quadruple occupancy requires exactly 4 people';
            document.querySelector('.add-button').insertAdjacentElement('afterend', warning);
            return;
        }
    }

    const childrenDOB = [];

    for (let i = 1; i <= children; i++) {
        childrenDOB.push({
            day: document.getElementById(`child${i}Day`).value,
            month: document.getElementById(`child${i}Month`).value,
            year: document.getElementById(`child${i}Year`).value
        });
    }

    const basketItem = {
        product_id: currentProductId,
        cabinCode: selectedCabin.item_code,
        cabinName: selectedCabin.item_name,
        occupancyType: occupancyType || null,  // Store occupancy type if available
        adults,
        children,
        childrenDOB,
        price: parseFloat(document.querySelector('.total-price').textContent.replace(/[^0-9.-]+/g, '')),
        discounts: Math.abs(parseFloat(document.querySelector('.discounts-applied').textContent.replace(/[^0-9.-]+/g, ''))) || 0
    };

    if (editingBasketItemIndex !== null) {
        basket[editingBasketItemIndex] = basketItem;
        editingBasketItemIndex = null;
        document.querySelector('.add-button').textContent = 'Add';
    } else {
        basket.push(basketItem);
    }

    saveBasket(basket);
    resetSelectionPanel();
}

function editBasketItem(index) {
    const basket = getBasket();
    const item = basket[index];
    editingBasketItemIndex = index;

    // Select the cabin first to initialize everything
    selectCabin(item.cabinCode);

    // Set occupancy type
    const occupancyTypeSelect = document.getElementById('occupancyType');
    if (item.occupancyType && occupancyTypeSelect) {
        occupancyTypeSelect.value = item.occupancyType;
        
        // Trigger change event to set up the correct options
        occupancyTypeSelect.dispatchEvent(new Event('change'));
    }
    
    // Now that occupancy type is set, configure adults and children values
    const adultsSelect = document.getElementById('adults');
    const childrenSelect = document.getElementById('children');
    
    if (adultsSelect) adultsSelect.value = item.adults;
    if (childrenSelect) childrenSelect.value = item.children;
    
    // If we have children, create the DOB fields first before setting values
    if (parseInt(item.children) > 0 && childrenSelect) {
        // First trigger the children change to create DOB fields
        updateChildrenDOBFields();
        
        // Now set the DOB values immediately after creating the fields
        if (item.childrenDOB && Array.isArray(item.childrenDOB)) {
            item.childrenDOB.forEach((dob, i) => {
                const dayField = document.getElementById(`child${i + 1}Day`);
                const monthField = document.getElementById(`child${i + 1}Month`);
                const yearField = document.getElementById(`child${i + 1}Year`);
                
                if (dayField) dayField.value = dob.day || '';
                if (monthField) monthField.value = dob.month || '';
                if (yearField) yearField.value = dob.year || '';
            });
        }
    }

    // Update button text
    const addButton = document.querySelector('.add-button');
    if (addButton) addButton.textContent = 'Update';

    // Update price display
    updateTotalPrice();
}

function removeBasketItem(index) {
    const basket = getBasket();
    // Reset selection panel state
    resetSelectionPanel();
    // If removing the item that's being edited, reset the edit state
    if (index === editingBasketItemIndex) {
        editingBasketItemIndex = null;
        document.querySelector('.add-button').textContent = 'Add';
    }
    basket.splice(index, 1);
    saveBasket(basket);
    syncWithWizedDataStore();
}

function renderMiniBasket() {
    const basket = getBasket();
    const container = document.querySelector('.mini-basket-items');

    // Clear the container first
    container.innerHTML = '';
    
    // If we don't have cabin data yet, don't try to render items
    if (!cabinData) {
        return;
    }
    
    // Update cabin availability in UI
    document.querySelectorAll('.cabin').forEach(cabinEl => {
        const cabinCode = cabinEl.dataset.cabinCode;
        if (basket.some(item => item.product_id === currentProductId && item.cabinCode === cabinCode)) {
            cabinEl.classList.add('in-basket');
        } else {
            cabinEl.classList.remove('in-basket');
        }
    });

    // Filter and display only items for current product
    const currentProductItems = basket.filter(item => item.product_id === currentProductId);
    
    currentProductItems.forEach((item, index) => {
        const itemElement = document.createElement('div');
        itemElement.className = 'basket-item';
        const formattedPrice = (item.price || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const formattedDiscounts = (item.discounts || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        
        // Format occupancy type for display
        let occupancyDisplay = '';
        if (item.occupancyType) {
            switch(item.occupancyType) {
                case 'single':
                    occupancyDisplay = 'Single Occupancy';
                    break;
                case 'double':
                    occupancyDisplay = 'Double Occupancy';
                    break;
                case 'twin':
                    occupancyDisplay = 'Twin Occupancy';
                    break;
                case 'triple':
                    occupancyDisplay = 'Triple Occupancy';
                    break;
                case 'quadruple':
                    occupancyDisplay = 'Quadruple Occupancy';
                    break;
                case 'share':
                    occupancyDisplay = 'Share Occupancy';
                    break;
            }
        }
        
        const safeHTML = `<div class="modal_selected_item basket-item"><div class="basket-item-header"><div class="text-size-small text-weight-medium basket-item-title">${item.cabinName}</div><div class="basket-item-actions"><div class="modal_item_edit"><div class="icon-embed-xxsmall edit-button w-embed" data-action="edit" data-index="${index}"><svg role="img" aria-hidden="true" preserveAspectRatio="xMidYMid meet" fill="none" viewBox="0 0 16 16" height="100%" width="100%" xmlns="http://www.w3.org/2000/svg">
<g clip-path="url(#clip0_2168_661)">
<path stroke-linejoin="round" stroke-linecap="round" stroke-width="1.7" stroke="#1D1F31" d="M11.3333 2.00004C11.5084 1.82494 11.7163 1.68605 11.9451 1.59129C12.1738 1.49653 12.419 1.44775 12.6666 1.44775C12.9143 1.44775 13.1595 1.49653 13.3882 1.59129C13.617 1.68605 13.8249 1.82494 14 2.00004C14.1751 2.17513 14.314 2.383 14.4087 2.61178C14.5035 2.84055 14.5523 3.08575 14.5523 3.33337C14.5523 3.581 14.5035 3.82619 14.4087 4.05497C14.314 4.28374 14.1751 4.49161 14 4.66671L4.99998 13.6667L1.33331 14.6667L2.33331 11L11.3333 2.00004Z"></path>
</g>
<defs>
<clipPath id="clip0_2168_661">
<rect fill="white" height="16" width="16"></rect>
</clipPath>
</defs>
</svg></div></div><div class="modal_item_delete"><div class="icon-embed-xxsmall edit-button w-embed" data-action="remove" data-index="${index}"><svg role="img" aria-hidden="true" preserveAspectRatio="xMidYMid meet" fill="none" viewBox="0 0 16 16" height="100%" width="100%" xmlns="http://www.w3.org/2000/svg">
<path stroke-linejoin="round" stroke-linecap="round" stroke-width="1.7" stroke="#E82B2B" d="M2 4H3.33333H14"></path>
<path stroke-linejoin="round" stroke-linecap="round" stroke-width="1.7" stroke="#E82B2B" d="M12.6666 3.99992V13.3333C12.6666 13.6869 12.5262 14.026 12.2761 14.2761C12.0261 14.5261 11.6869 14.6666 11.3333 14.6666H4.66665C4.31302 14.6666 3.97389 14.5261 3.72384 14.2761C3.47379 14.026 3.33331 13.6869 3.33331 13.3333V3.99992M5.33331 3.99992V2.66659C5.33331 2.31296 5.47379 1.97382 5.72384 1.72378C5.97389 1.47373 6.31302 1.33325 6.66665 1.33325H9.33331C9.68694 1.33325 10.0261 1.47373 10.2761 1.72378C10.5262 1.97382 10.6666 2.31296 10.6666 2.66659V3.99992"></path>
<path stroke-linejoin="round" stroke-linecap="round" stroke-width="1.7" stroke="#E82B2B" d="M6.66669 7.33325V11.3333"></path>
<path stroke-linejoin="round" stroke-linecap="round" stroke-width="1.7" stroke="#E82B2B" d="M9.33331 7.33325V11.3333"></path>
</svg></div></div></div></div><div class="basket-item-details"><div class="modal_selected_person"><div class="icon-embed-xxsmall w-embed"><svg role="img" aria-hidden="true" preserveAspectRatio="xMidYMid meet" fill="none" viewBox="0 0 12 12" height="100%" width="100%" xmlns="http://www.w3.org/2000/svg">
<path fill="currentColor" d="M6 6C7.38071 6 8.5 4.88071 8.5 3.5C8.5 2.11929 7.38071 1 6 1C4.61929 1 3.5 2.11929 3.5 3.5C3.5 4.88071 4.61929 6 6 6Z"></path>
<path fill="currentColor" d="M6.00008 7.25C3.49508 7.25 1.45508 8.93 1.45508 11C1.45508 11.14 1.56508 11.25 1.70508 11.25H10.2951C10.4351 11.25 10.5451 11.14 10.5451 11C10.5451 8.93 8.50508 7.25 6.00008 7.25Z"></path>
</svg></div><div class="text-size-tiny text-weight-medium">Adults Added:</div><div class="text-size-tiny text-weight-medium">${item.adults}</div></div><div class="modal_selected_person"><div class="icon-embed-xxsmall w-embed"><svg role="img" aria-hidden="true" preserveAspectRatio="xMidYMid meet" fill="none" viewBox="0 0 12 12" height="100%" width="100%" xmlns="http://www.w3.org/2000/svg">
<path fill="currentColor" d="M6 6C7.38071 6 8.5 4.88071 8.5 3.5C8.5 2.11929 7.38071 1 6 1C4.61929 1 3.5 2.11929 3.5 3.5C3.5 4.88071 4.61929 6 6 6Z"></path>
<path fill="currentColor" d="M6.00008 7.25C3.49508 7.25 1.45508 8.93 1.45508 11C1.45508 11.14 1.56508 11.25 1.70508 11.25H10.2951C10.4351 11.25 10.5451 11.14 10.5451 11C10.5451 8.93 8.50508 7.25 6.00008 7.25Z"></path>
</svg></div><div class="text-size-tiny text-weight-medium">Children Added:</div><div class="text-size-tiny text-weight-medium">${item.children}</div></div><div class="modal_selected_person"><div class="icon-embed-xxsmall w-embed"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 25 24" height="24" width="25">
<path fill="#101010" d="M12.0151 2C6.49514 2 2.01514 6.48 2.01514 12C2.01514 17.52 6.49514 22 12.0151 22C17.5351 22 22.0151 17.52 22.0151 12C22.0151 6.48 17.5351 2 12.0151 2ZM8.74514 7.66C9.55514 7.66 10.2251 8.32 10.2251 9.14C10.2251 9.95 9.56514 10.62 8.74514 10.62C7.93514 10.62 7.26514 9.96 7.26514 9.14C7.26514 8.32 7.92514 7.66 8.74514 7.66ZM8.86514 15.8C8.71514 15.95 8.52514 16.02 8.33514 16.02C8.14514 16.02 7.95514 15.95 7.80514 15.8C7.51514 15.51 7.51514 15.03 7.80514 14.74L14.3551 8.19C14.6451 7.9 15.1251 7.9 15.4151 8.19C15.7051 8.48 15.7051 8.96 15.4151 9.25L8.86514 15.8ZM15.2851 16.34C14.4751 16.34 13.8051 15.68 13.8051 14.86C13.8051 14.05 14.4651 13.38 15.2851 13.38C16.0951 13.38 16.7651 14.04 16.7651 14.86C16.7651 15.68 16.1051 16.34 15.2851 16.34Z"></path>
</svg></div><div class="text-size-tiny text-weight-medium">Total Cabin Discounts Applied:</div><div class="text-size-tiny text-weight-medium">-$${formattedDiscounts}</div></div><div class="modal_selected_person"><div class="icon-embed-xxsmall w-embed"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" height="24" width="24">
<path fill="#101010" d="M12.752 15.92H13.402C14.052 15.92 14.592 15.34 14.592 14.64C14.592 13.77 14.282 13.6 13.772 13.42L12.762 13.07V15.92H12.752Z"></path>
<path fill="#101010" d="M11.972 1.89998C6.45202 1.91998 1.98202 6.40998 2.00202 11.93C2.02202 17.45 6.51202 21.92 12.032 21.9C17.552 21.88 22.022 17.39 22.002 11.87C21.982 6.34998 17.492 1.88998 11.972 1.89998ZM14.262 12C15.042 12.27 16.092 12.85 16.092 14.64C16.092 16.18 14.882 17.42 13.402 17.42H12.752V18C12.752 18.41 12.412 18.75 12.002 18.75C11.592 18.75 11.252 18.41 11.252 18V17.42H10.892C9.25202 17.42 7.92202 16.04 7.92202 14.34C7.92202 13.93 8.26202 13.59 8.67202 13.59C9.08202 13.59 9.42202 13.93 9.42202 14.34C9.42202 15.21 10.082 15.92 10.892 15.92H11.252V12.54L9.74202 12C8.96202 11.73 7.91202 11.15 7.91202 9.35998C7.91202 7.81998 9.12202 6.57998 10.602 6.57998H11.252V5.99998C11.252 5.58998 11.592 5.24998 12.002 5.24998C12.412 5.24998 12.752 5.58998 12.752 5.99998V6.57998H13.112C14.752 6.57998 16.082 7.95998 16.082 9.65998C16.082 10.07 15.742 10.41 15.332 10.41C14.922 10.41 14.582 10.07 14.582 9.65998C14.582 8.78998 13.922 8.07998 13.112 8.07998H12.752V11.46L14.262 12Z"></path>
<path fill="#101010" d="M9.42188 9.37002C9.42188 10.24 9.73187 10.41 10.2419 10.59L11.2519 10.94V8.08002H10.6019C9.95188 8.08002 9.42188 8.66002 9.42188 9.37002Z"></path>
</svg></div><div class="text-size-tiny text-weight-medium">Total Cabin Price:</div><div class="text-size-tiny text-weight-medium">$${formattedPrice}</div></div></div></div>`;
        itemElement.innerHTML = safeHTML;
        
        // Add event listeners
        itemElement.querySelectorAll('.edit-button').forEach(button => {
            button.addEventListener('click', () => {
                const action = button.dataset.action;
                const itemIndex = parseInt(button.dataset.index);
                if (action === 'edit') {
                    editBasketItem(itemIndex);
                    // trigger the Webflow interaction that closes the modal
                    //document.querySelector('[trigger_modal_close]').click();
                  
                } else if (action === 'remove') {
                    removeBasketItem(itemIndex);
                }
            });
        });
        container.appendChild(itemElement);
    });

    // Update summary
    const totalAdults = currentProductItems.reduce((sum, item) => sum + item.adults, 0);
    const totalChildren = currentProductItems.reduce((sum, item) => sum + item.children, 0);
    const totalDiscounts = currentProductItems.reduce((sum, item) => sum + item.discounts, 0);
    const totalPrice = currentProductItems.reduce((sum, item) => sum + (item.price || 0), 0);

    document.querySelector('.total-adults').textContent = totalAdults;
    document.querySelector('.total-children').textContent = totalChildren;
    document.querySelector('.total-discounts').textContent = totalDiscounts > 0 ? `-$${totalDiscounts.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '$0.00';
    document.querySelector('.basket-total-price').textContent = `$${totalPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function resetSelectionPanel() {
    selectedCabin = null;
    document.querySelectorAll('.cabin').forEach(el => el.classList.remove('selected'));

    // Reset cabin type info
    const cabinCategory = document.querySelector('.cabin-category');
    const cabinSize = document.querySelector('.cabin-size');
    cabinCategory.textContent = 'Select a Cabin';
    cabinSize.textContent = '-';

    document.getElementById('adults').disabled = true;
    document.getElementById('children').disabled = true;
    document.getElementById('childrenDOBContainer').innerHTML = '';
    document.querySelector('.add-button').disabled = true;
    document.querySelector('.add-button').textContent = 'Add';
    // Reset price display to initial state
    const priceDisplay = document.querySelector('.price-display');
    priceDisplay.innerHTML = getPriceDisplayTemplate();
}

function calculateAge(birthDate, departureDate) {
    const birth = new Date(birthDate);
    const departure = new Date(departureDate);
    let age = departure.getFullYear() - birth.getFullYear();
    const monthDiff = departure.getMonth() - birth.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && departure.getDate() < birth.getDate())) {
        age--;
    }
    
    return age;
}

function isEligibleForChildDiscount(day, month, year, departureDate) {
    if (!day || !month || !year || day === '' || month === '' || year === '') return false;
    
    const birthDate = new Date(year, month - 1, day);
    const age = calculateAge(birthDate, departureDate);
    
    return age >= CHILD_DISCOUNT_AGE_RANGE.min && age <= CHILD_DISCOUNT_AGE_RANGE.max;
}

function generateDayOptions(selectedDay = '') {
    let options = '<option value="">Day</option>';
    for (let i = 1; i <= 31; i++) {
        options += `<option value="${i}" ${selectedDay == i ? 'selected' : ''}>${i}</option>`;
    }
    return options;
}

function generateMonthOptions(selectedMonth = '') {
    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];
    let options = '<option value="">Month</option>';
    months.forEach((month, index) => {
        options += `<option value="${index + 1}"${selectedMonth == (index + 1) ? ' selected' : ''}>${month}</option>`;
    });
    return options;
}

function generateYearOptions(selectedYear = '') {
    const currentYear = new Date().getFullYear();
    const startYear = currentYear - 17; // Assuming max child age is 17
    const endYear = currentYear - 2;  // Assuming min child age is 2
    let options = '<option value="">Year</option>';
    for (let year = startYear; year <= endYear; year++) {
        options += `<option value="${year}"${selectedYear == year ? ' selected' : ''}>${year}</option>`;
    }
    return options;
}

function updateChildrenDOBFields() {
    const childrenCount = parseInt(document.getElementById('children').value) || 0;
    const container = document.getElementById('childrenDOBContainer');
    
    // Store existing DOB values
    const existingDOBs = [];
    for (let i = 1; i <= childrenCount; i++) {
        const day = document.getElementById(`child${i}Day`)?.value || '';
        const month = document.getElementById(`child${i}Month`)?.value || '';
        const year = document.getElementById(`child${i}Year`)?.value || '';
        existingDOBs.push({ day, month, year });
    }
    
    container.innerHTML = ''; // Clear existing fields

    for (let i = 1; i <= childrenCount; i++) {
        const dobGroup = document.createElement('div');
        dobGroup.innerHTML = 
            '<div class="card_children-wrap is-1 child-dob-group">' +
                '<div class="text-size-small">Enter Child ' + i + '\'s date of birth</div>' +
                '<div class="dob-fields">' +
                    '<div class="dob-field">' +
                        '<select id="child' + i + 'Day" name="dob_day" data-name="dob_day" class="card_children-select w-select">' +
                            generateDayOptions(existingDOBs[i - 1]?.day) +
                        '</select>' +
                    '</div>' +
                    '<div class="dob-field">' +
                        '<select id="child' + i + 'Month" name="dob_month" data-name="dob_month" class="card_children-select w-select">' +
                            generateMonthOptions(existingDOBs[i - 1]?.month) +
                        '</select>' +
                    '</div>' +
                    '<div class="dob-field">' +
                        '<select id="child' + i + 'Year" name="dob_year" data-name="dob_year" class="card_children-select w-select">' +
                            generateYearOptions(existingDOBs[i - 1]?.year) +
                        '</select>' +
                    '</div>' +
                '</div>' +
            '</div>';
        container.appendChild(dobGroup);
        
        // Add change listeners to all DOB fields
        ['Day', 'Month', 'Year'].forEach(field => {
            document.getElementById(`child${i}${field}`).addEventListener('change', updateTotalPrice);
        });
    }
    
    // Special handling for editing mode
    if (editingBasketItemIndex !== null) {
        const basket = getBasket();
        const item = basket[editingBasketItemIndex];
        
        // If we have children DOB data in the basket item, apply it to the form fields
        if (item && item.childrenDOB && Array.isArray(item.childrenDOB)) {
            item.childrenDOB.forEach((dob, i) => {
                const dayField = document.getElementById(`child${i + 1}Day`);
                const monthField = document.getElementById(`child${i + 1}Month`);
                const yearField = document.getElementById(`child${i + 1}Year`);
                
                if (dayField) dayField.value = dob.day || '';
                if (monthField) monthField.value = dob.month || '';
                if (yearField) yearField.value = dob.year || '';
            });
        }
    }
}

// Fetch and initialize data
async function fetchCabinData() {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        let productId = urlParams.get('product_id');
        
        // Safely try to get product ID from Wized if not in URL
        if (!productId && window.Wized) {
            try {
                productId = Wized.data.n.parameter.product_id;
            } catch (wizedError) {
                console.log('Wized data not yet available');
            }
        }
        
        // Store the current product ID
        currentProductId = productId;
        
        if (!productId) {
            throw new Error('No product ID provided');
        }
        
        const response = await fetch(`https://xdtz-oh4i-3nzx.n7d.xano.io/api:XeSy1hTp/cabin/${productId}`);
        cabinData = await response.json();
        // Create a map of cabin data using item_code as key
        cabinData.forEach(cabin => {
            cabinDataMap.set(cabin.item_code, cabin);
        });
        initializeCabinStates();
    } catch (error) {
        console.error('Error fetching cabin data:', error.message);
        // Display error message to user
        const deckSchematic = document.getElementById('deckSchematic');
        if (deckSchematic) {
            deckSchematic.innerHTML = `<div class="error-message">Unable to load cabin data. ${error.message}</div>`;
        }
    }
}

// Initialize cabin states based on fetched data
function initializeCabinStates() {
    // Find all SVG cabin elements
    document.querySelectorAll('[data-cabin-code]').forEach(cabinElement => {
        const cabinCode = cabinElement.dataset.cabinCode;
        const cabinData = cabinDataMap.get(cabinCode);
        
        if (cabinData) {
            // Set initial class based on availability
            const statusClass = cabinData.item_status === 0 ? 'available' : 'reserved';
            cabinElement.classList.add('cabin', statusClass);
        }
    });
}

// Cabin selection handling
function selectCabin(cabinCode) {
    const cabin = cabinDataMap.get(cabinCode);
    if (!cabin || (cabin.item_status !== 0)) return;

    // Update cabin type info
    const cabinCategory = document.querySelector('.cabin-category');
    const cabinSize = document.querySelector('.cabin-size');
    cabinCategory.textContent = cabin.item_name;
    cabinSize.textContent = cabin.max_occupancy;

    // Check if cabin is already in basket
    const basket = getBasket();
    if (basket.some(item => item.product_id === currentProductId &&
        item.cabinCode === cabinCode) && editingBasketItemIndex === null) {
        document.querySelector('.add-button').disabled = true;
        const priceDisplay = document.querySelector('.price-display');
        priceDisplay.innerHTML = `<p class="error-message">This cabin is already in your booking</p>`;
        return;
    } else {
        document.querySelector('.price-display').innerHTML = getPriceDisplayTemplate();
    }

    // Update UI selection
    document.querySelectorAll('.cabin').forEach(el => el.classList.remove('selected'));
    document.querySelector(`[data-cabin-code="${cabinCode}"]`).classList.add('selected');

    // Update state
    selectedCabin = cabin;

    // Clear DOB fields when selecting a new cabin
    if (editingBasketItemIndex === null) {
        document.getElementById('childrenDOBContainer').innerHTML = '';
    }

    // Configure occupancy selectors based on product category
    configureOccupancySelectors(cabin);
    updateTotalPrice();

    // Safely update Wized Data Store if available
    if (window.Wized) {
        window.Wized.push((Wized) => {
            Wized.data.v.show_cabin_categories = false;
            Wized.data.v.current_product_category_item_code = cabinCode;
        });
    }
}

function configureOccupancySelectors(cabin) {
    const adultsSelect = document.getElementById('adults');
    const childrenSelect = document.getElementById('children');
    const occupancyTypeSelect = document.getElementById('occupancyType');
    const category = cabin._product_category;
    
    // Ensure we have valid category and prices data
    if (!category || !Array.isArray(category.prices)) {
        console.error('Invalid cabin category or price structure');
        return;
    }
    
    const priceStructure = category.prices[0];
    
    // Check if this cabin category has occupancy-based pricing
    const hasOccupancyPricing = priceStructure && (
        priceStructure.PriceCode === 'SGL' || 
        priceStructure.PriceCode === 'DBL' ||
        priceStructure.PriceCode === 'TWN' ||
        priceStructure.PriceCode === 'TRP' ||
        priceStructure.PriceCode === 'QPL' ||
        priceStructure.Shared === true
    );

    // Always reset selects if we're not in editing mode
    if (editingBasketItemIndex === null) {
        adultsSelect.innerHTML = '';
        childrenSelect.innerHTML = '<option value="0">0 Children</option>';
    }

    // Show/hide and configure occupancy type selector
    if (hasOccupancyPricing) {
        occupancyTypeSelect.disabled = false;
        
        // Clear and rebuild occupancy options based on available prices
        // This is always safe to do since we need to show the correct options
        // for the selected cabin
        occupancyTypeSelect.innerHTML = '';
        
        // Add options based on available price codes
        category.prices.forEach(price => {
            if (price.PriceCode === 'SGL') {
                occupancyTypeSelect.add(new Option('Single Occupancy', 'single'));
            } else if (price.PriceCode === 'DBL' && !price.Shared) {
                occupancyTypeSelect.add(new Option('Double Occupancy', 'double'));
            } else if (price.PriceCode === 'TWN' && !price.Shared) {
                occupancyTypeSelect.add(new Option('Twin Occupancy', 'twin'));
            } else if (price.PriceCode === 'TRP' && !price.Shared) {
                occupancyTypeSelect.add(new Option('Triple Occupancy', 'triple'));
            } else if (price.PriceCode === 'QPL' && !price.Shared) {
                occupancyTypeSelect.add(new Option('Quadruple Occupancy', 'quadruple'));
            } else if (price.Shared) {
                occupancyTypeSelect.add(new Option('Share Occupancy (Same Gender)', 'share'));
            }
        });
        
        // Add change listener for occupancy type
        occupancyTypeSelect.onchange = function() {
            const selectedOccupancy = this.value;
            
            // Always completely rebuild the adults dropdown
            adultsSelect.innerHTML = '';
            
            // Reset the children dropdown 
            // IMPORTANT: Always reset children dropdown on occupancy type change,
            // regardless of editing mode
            childrenSelect.innerHTML = '<option value="0">0 Children</option>';
            document.getElementById('childrenDOBContainer').innerHTML = '';
            
            if (selectedOccupancy === 'single' || selectedOccupancy === 'share') {
                adultsSelect.add(new Option('1 Adult', '1'));
                adultsSelect.value = '1';
                adultsSelect.disabled = true;
                // For single or share occupancy, reset and disable children selection
                childrenSelect.value = '0';
                childrenSelect.disabled = true;
            } else if (selectedOccupancy === 'double' || selectedOccupancy === 'twin') {
                // Start with 2 adults as default
                adultsSelect.add(new Option('1 Adult', '1'));
                adultsSelect.add(new Option('2 Adults', '2'));
                // Always default to 2 adults for double/twin occupancy
                adultsSelect.value = '2';
                adultsSelect.disabled = true;
                childrenSelect.disabled = false;
                
                // Add listener to children select to adjust adults when child is selected
                const handleChildrenChange = function() {
                    const selectedChildren = parseInt(this.value) || 0;
                    if (selectedChildren > 0) {
                        adultsSelect.value = '1'; // Change to 1 adult when child is selected
                    } else {
                        adultsSelect.value = '2'; // Reset to 2 adults when no children
                    }
                    updateTotalPrice();
                };
                
                // Remove existing listener before adding new one to prevent duplicates
                childrenSelect.removeEventListener('change', handleChildrenChange);
                childrenSelect.addEventListener('change', handleChildrenChange);
                
                // CRITICAL: Always limit to max 1 child for double/twin occupancy
                // regardless of whether we're in editing mode
                childrenSelect.innerHTML = '<option value="0">0 Children</option>';
                childrenSelect.add(new Option('1 Child', '1'));
            } else if (selectedOccupancy === 'triple') {
                // For triple occupancy, allow 1-3 adults
                adultsSelect.add(new Option('1 Adult', '1'));
                adultsSelect.add(new Option('2 Adults', '2'));
                adultsSelect.add(new Option('3 Adults', '3'));
                adultsSelect.disabled = false;
                childrenSelect.disabled = false;
                
                // Add listener to adults select to enable/disable children selection
                adultsSelect.onchange = function() {
                    const selectedAdults = parseInt(this.value);
                    const remainingCapacity = 3 - selectedAdults;  // Triple occupancy max is 3
                    
                    // Always rebuild children options when adults change in triple occupancy
                    childrenSelect.innerHTML = '<option value="0">0 Children</option>';
                    
                    // Can only add children if there's remaining capacity and at least 1 adult
                    if (remainingCapacity > 0 && selectedAdults >= 1) {
                        for (let i = 1; i <= remainingCapacity; i++) {
                            childrenSelect.add(new Option(`${i} Child${i > 1 ? 'ren' : ''}`, i));
                        }
                        childrenSelect.disabled = false;
                    } else {
                        childrenSelect.disabled = true;
                    }
                    
                    // When not editing, ensure total people is 3 by default
                    if (editingBasketItemIndex === null) {
                        childrenSelect.value = remainingCapacity.toString();
                    }
                    updateChildrenDOBFields();
                    updateTotalPrice();
                };
                
                // Add listener to children select to adjust adults when child selection changes
                childrenSelect.onchange = function() {
                    const selectedChildren = parseInt(this.value) || 0;
                    const selectedAdults = parseInt(adultsSelect.value) || 0;
                    const totalPeople = selectedAdults + selectedChildren;
                    
                    // Only auto-adjust if not in editing mode or if total is not 3
                    if ((editingBasketItemIndex === null || totalPeople !== 3) && selectedChildren <= 2) {
                        // Auto-adjust adults when children changes to maintain total of 3
                        const newAdults = Math.max(1, 3 - selectedChildren);  // At least 1 adult
                        adultsSelect.value = newAdults.toString();
                    }
                    
                    updateChildrenDOBFields();
                    updateTotalPrice();
                };
                
                // Always set the adults dropdown first
                if (editingBasketItemIndex === null) {
                    // Initial setting - default to 3 adults and 0 children
                    adultsSelect.value = '3';
                }
                // Always trigger the adults change to set up children options
                adultsSelect.dispatchEvent(new Event('change'));
            } else if (selectedOccupancy === 'quadruple') {
                // For quadruple occupancy, allow 1-4 adults
                for (let i = 1; i <= 4; i++) {
                    adultsSelect.add(new Option(`${i} Adult${i > 1 ? 's' : ''}`, i));
                }
                adultsSelect.disabled = false;
                childrenSelect.disabled = false;
                
                // Add listener to adults select to enable/disable children selection
                adultsSelect.onchange = function() {
                    const selectedAdults = parseInt(this.value);
                    const remainingCapacity = 4 - selectedAdults;  // Quadruple occupancy max is 4
                    
                    // Always rebuild children options when adults change in quadruple occupancy
                    childrenSelect.innerHTML = '<option value="0">0 Children</option>';
                    
                    // Can only add children if there's remaining capacity and at least 1 adult
                    if (remainingCapacity > 0 && selectedAdults >= 1) {
                        for (let i = 1; i <= remainingCapacity; i++) {
                            childrenSelect.add(new Option(`${i} Child${i > 1 ? 'ren' : ''}`, i));
                        }
                        childrenSelect.disabled = false;
                    } else {
                        childrenSelect.disabled = true;
                    }
                    
                    // When not editing, ensure total people is 4 by default
                    if (editingBasketItemIndex === null) {
                        childrenSelect.value = remainingCapacity.toString();
                    }
                    updateChildrenDOBFields();
                    updateTotalPrice();
                };
                
                // Add listener to children select to adjust adults when child selection changes
                childrenSelect.onchange = function() {
                    const selectedChildren = parseInt(this.value) || 0;
                    const selectedAdults = parseInt(adultsSelect.value) || 0;
                    const totalPeople = selectedAdults + selectedChildren;
                    
                    // Only auto-adjust if not in editing mode or if total is not 4
                    if ((editingBasketItemIndex === null || totalPeople !== 4) && selectedChildren <= 3) {
                        // Auto-adjust adults when children changes to maintain total of 4
                        const newAdults = Math.max(1, 4 - selectedChildren);  // At least 1 adult
                        adultsSelect.value = newAdults.toString();
                    }
                    
                    updateChildrenDOBFields();
                    updateTotalPrice();
                };
                
                // Always set the adults dropdown first
                if (editingBasketItemIndex === null) {
                    // Initial setting - default to 4 adults and 0 children
                    adultsSelect.value = '4';
                }
                // Always trigger the adults change to set up children options
                adultsSelect.dispatchEvent(new Event('change'));
            } else {
                adultsSelect.disabled = true;
                childrenSelect.disabled = false;
            }
            
            updateTotalPrice();
        };
        
        // Set initial state and trigger change event to update the UI
        occupancyTypeSelect.dispatchEvent(new Event('change'));
        
        // Configure children dropdown if the cabin allows children
        adultsSelect.addEventListener('change', () => {
            // Need to update children options when adults change
            // but this is now handled in each occupancy type's specific handler
            updateTotalPrice();
        });
    } else {
        // Non-occupancy based pricing
        occupancyTypeSelect.disabled = true;
        
        // Reset to default adults/children selection behavior
        adultsSelect.disabled = false;
        
        if (editingBasketItemIndex === null) {
            adultsSelect.innerHTML = '';
            for (let i = 1; i <= cabin.max_occupancy; i++) {
                const adultPrice = priceStructure[`Adult${i}Price`];
                if (adultPrice !== null) {
                    const option = new Option(`${i} Adult${i > 1 ? 's' : ''}`, i);
                    adultsSelect.add(option);
                }
            }
            
            // Reset children dropdown
            childrenSelect.innerHTML = '<option value="0">0 Children</option>';
            document.getElementById('childrenDOBContainer').innerHTML = '';
            
            // Set up children dropdown based on remaining capacity
            const initialRemainingCapacity = cabin.max_occupancy - 1;
            if (initialRemainingCapacity > 0 && priceStructure.Child1Price !== null) {
                for (let i = 1; i <= initialRemainingCapacity; i++) {
                    const childPrice = priceStructure[`Child${i}Price`];
                    if (childPrice !== null) {
                        const option = new Option(`${i} Child${i > 1 ? 'ren' : ''}`, i);
                        childrenSelect.add(option);
                    }
                }
                childrenSelect.disabled = false;
            } else {
                childrenSelect.disabled = true;
            }
        }
        
        // Configure adults select change event for non-occupancy cabins
        adultsSelect.addEventListener('change', () => {
            // Always rebuild children dropdown when adults change for non-occupancy cabins
            const selectedAdults = parseInt(adultsSelect.value);
            const remainingCapacity = cabin.max_occupancy - selectedAdults;
            
            // Clear the children dropdown
            childrenSelect.innerHTML = '<option value="0">0 Children</option>';
            document.getElementById('childrenDOBContainer').innerHTML = '';
            
            // Add appropriate child options
            if (remainingCapacity > 0 && priceStructure.Child1Price !== null) {
                for (let i = 1; i <= remainingCapacity; i++) {
                    const childPrice = priceStructure[`Child${i}Price`];
                    if (childPrice !== null) {
                        const option = new Option(`${i} Child${i > 1 ? 'ren' : ''}`, i);
                        childrenSelect.add(option);
                    }
                }
                childrenSelect.disabled = false;
            } else {
                childrenSelect.disabled = true;
            }
            
            updateTotalPrice();
        });
    }
    
    // Add event listener for children select
    childrenSelect.addEventListener('change', updateChildrenDOBFields);
    childrenSelect.addEventListener('change', updateTotalPrice);

    // Enable add button
    document.querySelector('.add-button').disabled = false;
    document.querySelector('.add-button').onclick = addToBasket;
}

function updateTotalPrice() {
    if (!selectedCabin) return;

    const priceDisplay = document.querySelector('.price-display');
    const pricePerPersonEl = priceDisplay.querySelector('.price-per-person');
    const discountsAppliedEl = priceDisplay.querySelector('.discounts-applied');
    const totalPriceEl = priceDisplay.querySelector('.total-price');

    const adults = parseInt(document.getElementById('adults').value);
    const children = parseInt(document.getElementById('children').value) || 0;
    const occupancyType = document.getElementById('occupancyType').value;
    const category = selectedCabin._product_category;
    let activePriceStructure = category.prices[0];
    const departureDate = selectedCabin._product.start_date;
    const prices = category.prices;
    
    // Determine base price based on pricing structure
    let basePrice = 0;
    if (occupancyType) {
        // Find the matching price structure for the selected occupancy type
        const selectedPrice = prices.find(price => {
            if (occupancyType === 'single' && price.PriceCode === 'SGL') return true;
            if (occupancyType === 'double' && price.PriceCode === 'DBL' && !price.Shared) return true;
            if (occupancyType === 'twin' && price.PriceCode === 'TWN' && !price.Shared) return true;
            if (occupancyType === 'triple' && price.PriceCode === 'TRP' && !price.Shared) return true;
            if (occupancyType === 'quadruple' && price.PriceCode === 'QPL' && !price.Shared) return true;
            if (occupancyType === 'share' && price.Shared) return true;
            return false;
        });
        basePrice = selectedPrice ? selectedPrice.Adult1Price : 0;
        activePriceStructure = selectedPrice || activePriceStructure;
    } else {
        basePrice = activePriceStructure.Adult1Price;
    }

    let totalPrice = 0;
    let adultTotal = 0;
    let childrenTotal = 0;
    let totalDiscounts = 0;
    let hasMainDiscount = false;

    // Check for main discount
    if (category.xano_product_discount_id && category.xano_product_discount_id.length > 0) {
        hasMainDiscount = category.xano_product_discount_id.some(discount => 
            discount.discount_type !== 'Child Discount' && 
            (discount.discount_amount > 0 || discount.discount_percent > 0)
        );
    }

    // Calculate adults price
    if (occupancyType) {
        adultTotal = basePrice * adults;
        totalPrice += adultTotal;
    } else {
        for (let i = 1; i <= adults; i++) {
            const priceKey = `Adult${i}Price`;
            if (activePriceStructure[priceKey] !== null) {
                const price = activePriceStructure[priceKey];
                adultTotal += price;
                totalPrice += price;
            }
        }
    }

    // Calculate children price
    for (let i = 1; i <= children; i++) {
        const priceKey = `Child${i}Price`;
        if (activePriceStructure[priceKey] !== null) {
            const price = activePriceStructure[priceKey];
            childrenTotal += price;
            totalPrice += price;
        }
    }

    // Apply discounts
    if (category.xano_product_discount_id && category.xano_product_discount_id.length > 0) {
        category.xano_product_discount_id.forEach(discount => {
            if (discount.discount_type === 'Child Discount' && !hasMainDiscount) {
                if (children > 0) {
                    for (let i = 1; i <= children; i++) {
                        const day = document.getElementById(`child${i}Day`)?.value;
                        const month = document.getElementById(`child${i}Month`)?.value;
                        const year = document.getElementById(`child${i}Year`)?.value;
                        
                        if (isEligibleForChildDiscount(day, month, year, departureDate)) {
                            const childPrice = activePriceStructure[`Child${i}Price`];
                            if (discount.discount_percent && childPrice) {
                                const childDiscount = childPrice * (discount.discount_percent / 100);
                                totalDiscounts += childDiscount;
                                totalPrice -= childDiscount;
                            }
                        }
                    }
                }
            } else {
                if (discount.discount_amount && discount.discount_type !== 'Child Discount') {
                    const totalPeople = adults + children;
                    const amountDiscount = discount.discount_amount * totalPeople;
                    totalDiscounts += amountDiscount;
                    totalPrice -= amountDiscount;
                } else if (discount.discount_percent && discount.discount_type !== 'Child Discount') {
                    const percentDiscount = totalPrice * (discount.discount_percent / 100);
                    totalDiscounts += percentDiscount;
                    totalPrice -= percentDiscount;
                }
            }
        });
    }

    // Update price display
    pricePerPersonEl.textContent = `$${basePrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} pp`;
    discountsAppliedEl.textContent = totalDiscounts > 0 ? `-$${totalDiscounts.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-';
    totalPriceEl.textContent = `$${totalPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Initialize the application
fetchCabinData().then(() => {
    renderMiniBasket();
    if (currentProductId) {
        syncWithWizedDataStore();
    }
}).catch(() => {
    const deckSchematic = document.getElementById('deckSchematic');
    if (deckSchematic) {
        deckSchematic.innerHTML = `
            <div class="error-message">
                Please provide a product ID to view cabin availability.<br>
                Example: ?product_id=20568
            </div>`;
    }
});

// Add event delegation for SVG cabin selection
const deckSchematic = document.getElementById('deckSchematic');
if (deckSchematic) {
    deckSchematic.addEventListener('click', (e) => {
        const cabinElement = e.target.closest('[data-cabin-code]');
        if (cabinElement) {
            const cabinCode = cabinElement.dataset.cabinCode;
            selectCabin(cabinCode);
        }
    });
}

  }; // End "result" if.
// End of Wized JS API initialisation.
});
