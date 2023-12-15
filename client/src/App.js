import React, { Component } from "react";
import MyToken from "./contracts/MyToken.json";
import MyTokenSale from "./contracts/MyTokenSale.json";
import KycContract from "./contracts/KycContract.json";
import MyMarketplace from "./contracts/MyMarketplace.json";
import getWeb3 from "./getWeb3";
import axios from "axios";
import "mdb-react-ui-kit/dist/css/mdb.min.css";
import "@fortawesome/fontawesome-free/css/all.min.css";
import { FaEthereum } from "react-icons/fa6";

import "./styles.css";

class App extends Component {
  state = {
    loaded: false,
    kycAddress: "0x123",
    tokenSaleAddress: "",
    userTokens: 0,
    itemName: "",
    itemPrice: 0,
    listings: [],
    products: [],
    items: [],
    owner: "",
    isKYC: false,
  };

  componentDidMount = async () => {
    try {
      // Get network provider and web3 instance.
      this.web3 = await getWeb3();

      // Use web3 to get the user's accounts.
      this.accounts = await this.web3.eth.getAccounts();

      // Get the contract instance.
      //this.networkId = await this.web3.eth.net.getId(); <<- this doesn't work with MetaMask anymore
      this.networkId = await this.web3.eth.getChainId();

      this.myToken = new this.web3.eth.Contract(
        MyToken.abi,
        MyToken.networks[this.networkId] &&
          MyToken.networks[this.networkId].address
      );

      this.myTokenSale = new this.web3.eth.Contract(
        MyTokenSale.abi,
        MyTokenSale.networks[this.networkId] &&
          MyTokenSale.networks[this.networkId].address
      );
      this.kycContract = new this.web3.eth.Contract(
        KycContract.abi,
        KycContract.networks[this.networkId] &&
          KycContract.networks[this.networkId].address
      );
      this.myMarketplace = new this.web3.eth.Contract(
        MyMarketplace.abi,
        MyMarketplace.networks[this.networkId] &&
          MyMarketplace.networks[this.networkId].address
      );
      await axios
        .get("http://localhost:4000/item")
        .then((response) => {
          console.log(response.data);
          this.setState({ items: [...this.state.items, response.data] });
        })
        .catch(function (error) {
          console.log(error);
        });

      for (var i = 0; i < this.state.items[0].data.length; i++) {
        const product = await this.state.items[0].data[i];
        this.setState({ products: [...this.state.products, product] });
      }
      console.log(await this.state.products);

      const kyc = await this.kycContract.methods
        .kycCompleted(this.accounts[0])
        .call();
      this.setState({ isKYC: kyc });
      console.log(this.state.isKYC);

      // Set web3, accounts, and contract to the state, and then proceed with an
      // example of interacting with the contract's methods.
      this.listenToTokenTransfer();
      this.updateProductList();
      this.listenIsOwner();
      this.setState(
        { loaded: true, tokenSaleAddress: this.myTokenSale._address },
        this.updateUserTokens
      );

      let promise = await this.myMarketplace.methods
        .getOwner()
        .call()
        .then(function (value) {
          return value;
        });
      this.setState({ owner: promise });
      console.log(this.accounts[0] === this.state.owner);
    } catch (error) {
      // Catch any errors for any of the above operations.
      alert(
        `Failed to load web3, accounts, or contract. Check console for details.`
      );
      console.error(error);
    }
  };

  handleInputChange = (event) => {
    const target = event.target;
    const value = target.type === "checkbox" ? target.checked : target.value;
    const name = target.name;
    this.setState({
      [name]: value,
    });
  };

  handleKycSubmit = async () => {
    const { kycAddress } = this.state;
    if (
      (await this.kycContract.methods.kycCompleted(kycAddress).call()) == false
    ) {
      await this.kycContract.methods
        .setKycCompleted(kycAddress)
        .send({ from: this.accounts[0] });
      alert("Account " + kycAddress + " is now whitelisted");
    } else {
      alert("Account " + kycAddress + " is already whitelisted");
    }
  };

  handleBuyToken = async () => {
    if (
      (await this.kycContract.methods.kycCompleted(this.accounts[0]).call()) ==
      false
    ) {
      alert("Account " + this.accounts[0] + " is not in whitelisted");
    } else {
      await this.myTokenSale.methods
        .buyTokens(this.accounts[0])
        .send({ from: this.accounts[0], value: 1 });
    }
  };

  handleItemInputChange = (event) => {
    const target = event.target;
    const value = target.type === "checkbox" ? target.checked : target.value;
    const name = target.name;
    this.setState({
      [name]: value,
    });
  };

  handleListItem = async () => {
    try {
      const { itemName, itemPrice } = this.state;

      // Ensure that itemName is not empty and itemPrice is greater than 0
      if (!itemName || itemPrice <= 0) {
        alert("Please enter valid item details.");
        return;
      }

      // Call the smart contract method to list a new item on the marketplace
      const resutl = await this.myMarketplace.methods
        .listNewItem(itemName, itemPrice)
        .send({ from: this.accounts[0] });

      // Handle successful transaction
      alert(
        `Item "${itemName}" listed on the marketplace for ${itemPrice} ETH.`
      );

      // Optional: Update the UI or fetch updated marketplace listings
      // this.fetchMarketplaceListings();

      console.log(resutl.events.ItemListed.returnValues);
      const obj = {
        itemName: this.state.itemName,
        itemId: resutl.events.ItemListed.returnValues.listingId,
        price: this.state.itemPrice,
        address: this.accounts[0],
        state: resutl.events.ItemListed.returnValues._step,
        owner: resutl.events.ItemListed.returnValues.seller,
        date: new Date(),
      };
      axios
        .post("http://localhost:4000/item/create", obj)
        .then((res) => console.log(res.data));
      console.log(obj);
    } catch (error) {
      // Handle errors, e.g., transaction rejection or failure
      alert(`Failed to list the item. Error: ${error.message}`);
    }
  };

  handlePurchaseItem = async (itemId, productId) => {
    try {
      const price = this.state.listings.find(
        (item) => (item.itemId = itemId)
      )?.price;
      const balanceAccount = await this.myToken.methods
        .balanceOf(this.accounts[0])
        .call();
      console.log(balanceAccount);
      if (balanceAccount < price) {
        alert("Your current token is not enough!");
        return;
      }

      // Ensure the price is valid
      if (!price || price <= 0) {
        alert("Invalid item price.");
        return;
      }
      // Call the smart contract method to purchase an item on the marketplace
      await this.myToken.methods
        .approve(this.myMarketplace._address, price)
        .send({ from: this.accounts[0] });
      const resutl = await this.myMarketplace.methods
        .purchaseItem(itemId)
        .send({ from: this.accounts[0] });

      // Handle successful transaction
      alert(`Item with Listing ID ${itemId} purchased.`);

      console.log(resutl.events.ItemListed.returnValues);

      const obj = {
        state: resutl.events.ItemListed.returnValues._step,
        address: this.accounts[0],
      };
      axios
        .put("http://localhost:4000/item//update/" + productId, obj)
        .then((res) => console.log(res.data));
      this.updateProductList();
    } catch (error) {
      // Handle errors, e.g., transaction rejection or failure
      alert(`Failed to purchase the item. Error: ${error.message}`);
    }
  };

  handleDeliverItem = async (itemid, productId) => {
    try {
      const price = this.state.listings.find(
        (item) => (item.itemid = itemid)
      )?.price;

      // Call the smart contract method to purchase an item on the marketplace
      await this.myToken.methods
        .approve(this.myMarketplace._address, price)
        .send({ from: this.accounts[0] });
      const resutl = await this.myMarketplace.methods
        .deliverItem(itemid)
        .send({ from: this.accounts[0] });

      // Handle successful transaction
      alert(`Item with Listing ID ${itemid} delivery.`);

      // Optional: Update the UI or fetch updated marketplace listings
      // this.fetchMarketplaceListings();

      console.log(resutl.events.ItemListed.returnValues);
      const obj = {
        state: resutl.events.ItemListed.returnValues._step,
      };
      axios
        .put("http://localhost:4000/item//update/" + productId, obj)
        .then((res) => console.log(res.data));
      this.updateProductList();
    } catch (error) {
      // Handle errors, e.g., transaction rejection or failure
      alert(`Failed to purchase the item. Error: ${error.message}`);
    }
  };

  handleReceivedItem = async (itemId, productId) => {
    try {
      const price = this.state.listings.find(
        (item) => (item.itemId = itemId)
      )?.price;

      // Call the smart contract method to purchase an item on the marketplace
      await this.myToken.methods
        .approve(this.myMarketplace._address, price)
        .send({ from: this.accounts[0] });
      const resutl = await this.myMarketplace.methods
        .receivedItem(itemId)
        .send({ from: this.accounts[0] });

      // Handle successful transaction
      alert(`Item with Listing ID ${itemId} delivery.`);

      // Optional: Update the UI or fetch updated marketplace listings
      // this.fetchMarketplaceListings();

      console.log(resutl.events.ItemListed.returnValues);
      const obj = {
        state: resutl.events.ItemListed.returnValues._step,
      };
      axios
        .put("http://localhost:4000/item//update/" + productId, obj)
        .then((res) => console.log(res.data));
      this.updateProductList();
    } catch (error) {
      // Handle errors, e.g., transaction rejection or failure
      alert(`Failed to purchase the item. Error: ${error.message}`);
    }
  };

  updateUserTokens = async () => {
    let userTokens = await this.myToken.methods
      .balanceOf(this.accounts[0])
      .call();
    this.setState({ userTokens: userTokens });
  };

  updateProductList = async () => {
    try {
      const totalListings = await this.myMarketplace.methods
        .getTotalListings()
        .call();
      const listingIds = await this.myMarketplace.methods
        .getListingIds()
        .call();

      const updatedListings = [];

      for (let i = 0; i < totalListings; i++) {
        const listingId = listingIds[i];
        const listingDetails = await this.myMarketplace.methods
          .getItemDetails(listingId)
          .call();
        updatedListings.push({ listingId, ...listingDetails });
      }

      this.setState({ listings: updatedListings });
      console.log("Updated product list:", updatedListings);
    } catch (error) {
      console.error("Error updating product list:", error);
    }
  };

  listenToTokenTransfer = async () => {
    this.myToken.events
      .Transfer({ to: this.accounts[0] })
      .on("data", this.updateUserTokens);
  };

  listenIsOwner = async () => {
    const isOwner = await this.myMarketplace.methods.isOwner().call();
    this.setState({ owner: isOwner });
  };

  render() {
    if (!this.state.loaded) {
      return <div>Loading Web3, accounts, and contract...</div>;
    }

    return (
      <div className="container">
        <div className="header">
          {this.state.owner === this.accounts[0] ? (
            <div>
              <div className="container_kyc">
                <img src="https://i.pinimg.com/originals/e0/50/54/e05054acb8e44b7b716f7e7c659ead35.jpg" />
                <h1>Shark Tokens for Restaurants</h1>
                <form>
                  <label for="kycAddress">Address to allow:</label>
                  <input
                    type="text"
                    class="form-control"
                    id="kycAddress"
                    name="kycAddress"
                    value={this.state.kycAddress}
                    onChange={this.handleInputChange}
                  />
                  <button
                    type="button"
                    class="btn btn-primary"
                    onClick={this.handleKycSubmit}
                  >
                    Add Address to Whitelist
                  </button>
                </form>
              </div>
            </div>
          ) : (
            <img
              src="https://i.pinimg.com/originals/88/8d/d3/888dd3bcd41b1ccf7826d22c3e2ea63e.jpg"
              style={{ marginLeft: "50px" }}
            />
          )}

          <div className="account">
            <h1>Account: {this.accounts[0]}</h1>
            {this.state.isKYC && <h1>Account has KYC</h1>}
            {!this.state.isKYC && <h1>Account has not been KYC</h1>}
          </div>
        </div>

        <div>
          <div className="container_buy">
            <h2>Buy Shark-Tokens</h2>
            <p>Send Ether to this address: {this.state.tokenSaleAddress}</p>
            <p>You have: {this.state.userTokens} ETH</p>
            <button
              type="button"
              class="btn btn-primary"
              onClick={this.handleBuyToken}
            >
              Buy more tokens
            </button>
          </div>

          <div className="container_marketplace">
            <h1>My Marketplace</h1>
            <h3>Create New Item</h3>
            <label>Item Name:</label>
            <input
              type="text"
              name="itemName"
              value={this.state.itemName}
              onChange={this.handleItemInputChange}
            />
            <label>Item Price (ETH):</label>
            <input
              type="number"
              name="itemPrice"
              value={this.state.itemPrice}
              onChange={this.handleItemInputChange}
            />
            <button type="button" onClick={this.handleListItem}>
              List Item
            </button>
            <div className="list_item">
              <h3>Show list Item</h3>
              <div id="productList" className="items">
                {this.state.products && this.state.products.length > 0 ? (
                  this.state.products.map((product, key) => {
                    let text = "";
                    if (product.state == 0) {
                      text = "Stocking";
                    } else if (product.state == 1) {
                      text = "Waiting for shipping";
                    } else if (product.state == 2) {
                      text = "Already shipped";
                    } else if (product.state == 3) {
                      text = "Delivery successful";
                    } else {
                      text = "Cancel";
                    }
                    return (
                      <div key={key} className="item">
                        <div
                          style={{
                            display: "flex",
                            gap: 10,
                            alignItems: "center",
                            textTransform: "capitalize",
                          }}
                        >
                          <h3 scope="row" style={{}}>
                            {key}:
                          </h3>
                          <h4>{product.itemName}</h4>
                        </div>
                        <p>
                          <FaEthereum /> {product.price} ETH
                        </p>
                        <p>
                          <b>Owner:</b> {product.address}
                        </p>
                        <p>
                          <b>State of Item: </b>
                          {text}
                        </p>
                        <div>
                          {product.state == 0 ? (
                            product.owner === this.accounts[0] ? (
                              "You are Ower"
                            ) : (
                              <button
                                onClick={() => {
                                  this.handlePurchaseItem(
                                    product.itemId,
                                    product._id
                                  );
                                }}
                              >
                                Buy
                              </button>
                            )
                          ) : product.state == 1 ? (
                            product.owner === this.accounts[0] ? (
                              <button
                                onClick={() => {
                                  this.handleDeliverItem(
                                    product.itemId,
                                    product._id
                                  );
                                }}
                              >
                                Delivery
                              </button>
                            ) : null
                          ) : product.state == 2 ? (
                            product.owner === this.accounts[0] ? (
                              "You are Owner"
                            ) : (
                              <div>
                                <button
                                  onClick={() => {
                                    this.handleReceivedItem(
                                      product.itemId,
                                      product._id
                                    );
                                  }}
                                >
                                  Received
                                </button>
                              </div>
                            )
                          ) : null}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p>Không có hàng được bán...</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
}

export default App;
