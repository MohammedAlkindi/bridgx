// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IERC20 {
    function balanceOf(address account) external view returns (uint256);

    function transferFrom(address from, address to, uint256 amount) external returns (bool);

    function approve(address spender, uint256 amount) external returns (bool);

    function transfer(address to, uint256 amount) external returns (bool);
}

interface ITokenMessengerV2 {
    function depositForBurnWithHook(
        uint256 amount,
        uint32 destinationDomain,
        bytes32 mintRecipient,
        address burnToken,
        bytes32 destinationCaller,
        uint256 maxFee,
        uint32 minFinalityThreshold,
        bytes calldata hookData
    ) external;
}

contract SourceExecutor {
    address public immutable owner;
    address public immutable odosRouter;
    address public immutable usdc;
    address public immutable tokenMessenger;

    event SwapAndBurnExecuted(
        address indexed inputToken,
        uint256 amountIn,
        uint256 usdcOut,
        uint32 destinationDomain,
        bytes32 mintRecipient
    );

    event TokenRescued(address indexed token, address indexed to, uint256 amount);
    event NativeRescued(address indexed to, uint256 amount);

    error ZeroAddress();
    error NativeValueNotAllowed();
    error OdosSwapFailed();
    error UsdcOutZero();
    error NotOwner();
    error InvalidRecipient();
    error RescueFailed();
    error ERC20CallFailed(address token, bytes4 selector);
    error ERC20CallReturnedFalse(address token, bytes4 selector);

    constructor(address odosRouter_, address usdc_, address tokenMessenger_) {
        if (odosRouter_ == address(0) || usdc_ == address(0) || tokenMessenger_ == address(0)) {
            revert ZeroAddress();
        }
        owner = msg.sender;
        odosRouter = odosRouter_;
        usdc = usdc_;
        tokenMessenger = tokenMessenger_;
    }

    function executeSwapAndBurn(
        address inputToken,
        uint256 amountIn,
        bytes calldata odosData,
        uint32 destinationDomain,
        bytes32 mintRecipient,
        bytes32 destinationCaller,
        uint256 maxFee,
        uint32 minFinalityThreshold,
        bytes calldata hookData
    ) external {
        if (msg.value != 0) {
            revert NativeValueNotAllowed();
        }

        _safeTransferFrom(inputToken, msg.sender, address(this), amountIn);
        _forceApprove(inputToken, odosRouter, amountIn);

        uint256 usdcBefore = IERC20(usdc).balanceOf(address(this));
        (bool success, ) = odosRouter.call(odosData);
        if (!success) {
            revert OdosSwapFailed();
        }

        uint256 usdcAfter = IERC20(usdc).balanceOf(address(this));
        uint256 usdcOut = usdcAfter - usdcBefore;
        if (usdcOut == 0) {
            revert UsdcOutZero();
        }

        _forceApprove(usdc, tokenMessenger, usdcOut);
        ITokenMessengerV2(tokenMessenger).depositForBurnWithHook(
            usdcOut,
            destinationDomain,
            mintRecipient,
            usdc,
            destinationCaller,
            maxFee,
            minFinalityThreshold,
            hookData
        );

        emit SwapAndBurnExecuted(inputToken, amountIn, usdcOut, destinationDomain, mintRecipient);
    }

    function rescueToken(address token, address to, uint256 amount) external {
        if (msg.sender != owner) {
            revert NotOwner();
        }
        if (to == address(0)) {
            revert InvalidRecipient();
        }
        _safeTransfer(token, to, amount);
        emit TokenRescued(token, to, amount);
    }

    function rescueNative(address payable to, uint256 amount) external {
        if (msg.sender != owner) {
            revert NotOwner();
        }
        if (to == address(0)) {
            revert InvalidRecipient();
        }
        (bool success, ) = to.call{value: amount}("");
        if (!success) {
            revert RescueFailed();
        }
        emit NativeRescued(to, amount);
    }

    function _safeTransferFrom(address token, address from, address to, uint256 amount) internal {
        _callOptionalReturn(
            token,
            IERC20.transferFrom.selector,
            abi.encodeWithSelector(IERC20.transferFrom.selector, from, to, amount)
        );
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
