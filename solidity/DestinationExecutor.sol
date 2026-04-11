// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IERC20 {
    function balanceOf(address account) external view returns (uint256);

    function transfer(address to, uint256 amount) external returns (bool);
}

contract DestinationExecutor {
    address public immutable owner;
    address public immutable usdc;
    address public relayer;

    event RelayerUpdated(address indexed relayer);
    event Released(address indexed recipient, uint256 amount);
    event TokenRescued(address indexed token, address indexed to, uint256 amount);
    event NativeRescued(address indexed to, uint256 amount);

    error ZeroAddress();
    error NotOwner();
    error NotRelayer();
    error InvalidRecipient();
    error RescueFailed();
    error ERC20CallFailed(address token, bytes4 selector);
    error ERC20CallReturnedFalse(address token, bytes4 selector);

    modifier onlyOwner() {
        if (msg.sender != owner) {
            revert NotOwner();
        }
        _;
    }

    modifier onlyRelayer() {
        if (msg.sender != relayer) {
            revert NotRelayer();
        }
        _;
    }

    constructor(address usdc_, address relayer_) {
        if (usdc_ == address(0) || relayer_ == address(0)) {
            revert ZeroAddress();
        }
        owner = msg.sender;
        usdc = usdc_;
        relayer = relayer_;
    }

    function setRelayer(address newRelayer) external onlyOwner {
        if (newRelayer == address(0)) {
            revert ZeroAddress();
        }
        relayer = newRelayer;
        emit RelayerUpdated(newRelayer);
    }

    function release(address recipient, uint256 amount) external onlyRelayer {
        if (recipient == address(0)) {
            revert InvalidRecipient();
        }
        _safeTransfer(usdc, recipient, amount);
        emit Released(recipient, amount);
    }

    function rescueToken(address token, address to, uint256 amount) external onlyOwner {
        if (to == address(0)) {
            revert InvalidRecipient();
        }
        _safeTransfer(token, to, amount);
        emit TokenRescued(token, to, amount);
    }

    function rescueNative(address payable to, uint256 amount) external onlyOwner {
        if (to == address(0)) {
            revert InvalidRecipient();
        }
        (bool success, ) = to.call{value: amount}("");
        if (!success) {
            revert RescueFailed();
        }
        emit NativeRescued(to, amount);
    }

    function _safeTransfer(address token, address to, uint256 amount) internal {
        _callOptionalReturn(
            token,
            IERC20.transfer.selector,
            abi.encodeWithSelector(IERC20.transfer.selector, to, amount)
        );
    }

    function _callOptionalReturn(address token, bytes4 selector, bytes memory data) internal {
        (bool success, bytes memory returndata) = token.call(data);
        if (!success) {
            if (returndata.length > 0) {
                assembly {
                    revert(add(returndata, 32), mload(returndata))
                }
            }
            revert ERC20CallFailed(token, selector);
        }
        if (returndata.length > 0) {
            if (!abi.decode(returndata, (bool))) {
                revert ERC20CallReturnedFalse(token, selector);
            }
        }
    }
}
