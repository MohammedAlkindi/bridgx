// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IERC20 {
    function balanceOf(address account) external view returns (uint256);

    function transfer(address to, uint256 amount) external returns (bool);

    function approve(address spender, uint256 amount) external returns (bool);
}

contract DestinationExecutor {
    address public immutable owner;
    address public immutable odosRouter;
    address public immutable usdc;
    address public relayer;

    event RelayerUpdated(address indexed relayer);
    event SwapAndTransferExecuted(
        address indexed outputToken,
        address indexed recipient,
        uint256 usdcIn,
        uint256 amountOut
    );
    event UsdcReleased(address indexed recipient, uint256 amount);
    event TokenRescued(address indexed token, address indexed to, uint256 amount);
    event NativeRescued(address indexed to, uint256 amount);

    error ZeroAddress();
    error NotOwner();
    error NotRelayer();
    error InvalidRecipient();
    error NativeValueNotAllowed();
    error OdosSwapFailed();
    error OutputTokenZero();
    error OutputAmountZero();
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

    constructor(address odosRouter_, address usdc_, address relayer_) {
        if (odosRouter_ == address(0) || usdc_ == address(0) || relayer_ == address(0)) {
            revert ZeroAddress();
        }
        owner = msg.sender;
        odosRouter = odosRouter_;
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

    function executeSwapAndTransfer(
        uint256 amountIn,
        bytes calldata odosData,
        address outputToken,
        address recipient
    ) external payable onlyRelayer {
        if (msg.value != 0) {
            revert NativeValueNotAllowed();
        }
        if (outputToken == address(0)) {
            revert OutputTokenZero();
        }
        if (recipient == address(0)) {
            revert InvalidRecipient();
        }

        _forceApprove(usdc, odosRouter, amountIn);
        uint256 beforeBalance = IERC20(outputToken).balanceOf(address(this));
        (bool success, ) = odosRouter.call(odosData);
        if (!success) {
            revert OdosSwapFailed();
        }
        uint256 afterBalance = IERC20(outputToken).balanceOf(address(this));
        uint256 amountOut = afterBalance - beforeBalance;
        if (amountOut == 0) {
            revert OutputAmountZero();
        }
        _safeTransfer(outputToken, recipient, amountOut);
        emit SwapAndTransferExecuted(outputToken, recipient, amountIn, amountOut);
    }

    function releaseUsdc(address recipient, uint256 amount) external onlyRelayer {
        if (recipient == address(0)) {
            revert InvalidRecipient();
        }
        _safeTransfer(usdc, recipient, amount);
        emit UsdcReleased(recipient, amount);
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

    function _forceApprove(address token, address spender, uint256 amount) internal {
        _callOptionalReturn(
            token,
            IERC20.approve.selector,
            abi.encodeWithSelector(IERC20.approve.selector, spender, 0)
        );
        _callOptionalReturn(
            token,
            IERC20.approve.selector,
            abi.encodeWithSelector(IERC20.approve.selector, spender, amount)
        );
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
