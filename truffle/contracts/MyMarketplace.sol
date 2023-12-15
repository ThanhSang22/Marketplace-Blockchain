// SPDX-License-Identifier: MIT
pragma solidity >=0.6.2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract MyMarketplace is Ownable, ReentrancyGuard {
    IERC20 private _sctToken;
    uint256 private _listingIdCounter;
    address private isOwner;

    enum SupplyChainState { Created, Paid, Delivered, Received, Cancel }

    struct Listing {
        address seller;
        string name;
        uint256 price;
        SupplyChainState state;
    }

    
    mapping(uint256 => Listing) private _listings;
    uint256[] private _listingIds;

    event ItemListed(uint256 indexed listingId, address indexed seller, uint256 price, uint _step);

    constructor(IERC20 sctToken) public {
        _sctToken = sctToken;
        _listingIdCounter = 1;
        isOwner=msg.sender; 
    }

    function listNewItem(string calldata  name, uint256 price) external {
        require(price > 0, "Price must be greater than 0");
        _listings[_listingIdCounter] = Listing(msg.sender,name, price, SupplyChainState.Created);
        _listingIds.push(_listingIdCounter);
        emit ItemListed(_listingIdCounter, msg.sender, price, uint(_listings[_listingIdCounter].state));
        _listingIdCounter++;
    }


    function purchaseItem(uint256 listingId) external nonReentrant {
        require(_listings[listingId].state == SupplyChainState.Created, "Only full payments accepted");
        uint256 price = _listings[listingId].price;
        _listings[listingId].state = SupplyChainState.Paid;

        // Check allowance and approve if necessary
        require(_sctToken.allowance(msg.sender, address(this)) >= price, "Insufficient allowance");
        
        // Transfer tokens from the buyer to ERC20 contract
        _sctToken.transferFrom(msg.sender, address(this), price);
     
        // Deactivate the listing
        emit ItemListed(listingId, msg.sender, price, uint(_listings[listingId].state));
    }

    function deliverItem(uint256 listingId) external nonReentrant {
        require(_listings[listingId].state == SupplyChainState.Paid, "Item is further in the supply chain");
        uint256 price = _listings[listingId].price;

        // require(_sctToken.allowance(msg.sender, address(this)) >= price, "Insufficient allowance");
        _listings[listingId].state = SupplyChainState.Delivered;
        _sctToken.transfer(msg.sender, price);

        emit ItemListed(listingId, msg.sender, _listings[listingId].price, uint(_listings[listingId].state));
    }

    function getOwner() public view returns (address) {     
        return isOwner; 
    } 

    function receivedItem(uint256 listingId) external nonReentrant {
        require(_listings[listingId].state == SupplyChainState.Delivered, "Item is further in the supply chain");
        // uint256 price = _listings[listingId].price;
        // require(_sctToken.allowance(msg.sender, address(this)) >= price, "Insufficient allowance");
        _listings[listingId].state = SupplyChainState.Received;
        emit ItemListed(listingId, msg.sender, _listings[listingId].price, uint(_listings[listingId].state));
    }

    function getItemDetails(uint256 listingId) external view returns (address seller,string memory name, uint256 price, uint _state) {
        require(listingId > 0 && listingId < _listingIdCounter, "Invalid listing ID");
        Listing memory listing = _listings[listingId];
        return (listing.seller,listing.name, listing.price, uint(listing.state));
    }

    function getTotalListings() external view returns (uint256) {
        return _listingIds.length;
    }

    function getListingIds() external view returns (uint256[] memory) {
        return _listingIds;
    }
}
