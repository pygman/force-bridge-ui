import Icon from '@ant-design/icons';
import { Asset, utils } from '@force-bridge/commons';
import { Button, Divider, Modal, Row, Typography } from 'antd';
import { useFormik } from 'formik';
import React, { useEffect, useMemo } from 'react';
import styled from 'styled-components';
import { ReactComponent as BridgeDirectionIcon } from './resources/icon-bridge-direction.svg';
import { useBridgeInput, ValidationResult } from './useBridgeInput';
import { useBridgeTransaction } from './useBridgeTransaction';
import { HumanizeAmount } from 'components/AssetAmount';
import { AssetSelector } from 'components/AssetSelector';
import { AssetSymbol } from 'components/AssetSymbol';
import { StyledCardWrapper } from 'components/Styled';
import { UserInput } from 'components/UserInput';
import { WalletConnectorButton } from 'components/WalletConnector';
import { boom } from 'interfaces/errors';
import { BridgeDirection, useAssetQuery, useForceBridge } from 'state';
import { BeautyAmount } from 'suite';

const BridgeViewWrapper = styled(StyledCardWrapper)`
  .label {
    font-weight: bold;
    font-size: 12px;
    line-height: 14px;
    color: rgba(0, 0, 0, 0.8);
  }

  .input-wrapper {
    padding: 28px 0;
  }
`;

const Help: React.FC<{ validateStatus: 'error' | ''; help?: string }> = ({ validateStatus, help }) => {
  if (validateStatus !== 'error') return null;
  return (
    <Typography.Text type="danger" style={{ position: 'absolute' }}>
      {help}
    </Typography.Text>
  );
};

interface BridgeOperationProps {
  onAssetSelected: (asset: Asset) => void;
}

export const BridgeOperation: React.FC<BridgeOperationProps> = (props) => {
  const { signer, direction } = useForceBridge();
  const query = useAssetQuery();
  const formik = useFormik<ValidationResult>({
    onSubmit,
    initialValues: {},
    validate: () => errors,
  });

  const {
    bridgeOutInputAmount,
    bridgeInInputAmount,
    setBridgeInInputAmount,
    asset: selectedAsset,
    setAsset: setSelectedAsset,
    setRecipient,
    recipient,
    errors,
    validateStatus,
    // fee,
    reset,
  } = useBridgeInput();

  const {
    mutateAsync: sendBridgeTransaction,
    data: bridgeTxData,
    error: bridgeTxError,
    isLoading,
  } = useBridgeTransaction();

  function resetForm() {
    reset();
    if (!signer) return;

    if (direction === BridgeDirection.In) setRecipient(signer.identityNervos());
    else setRecipient(signer.identityXChain());
  }

  useEffect(resetForm, [direction, reset, setRecipient, signer]);

  function onSubmit() {
    if (!selectedAsset || !recipient || !selectedAsset.shadow) return;

    const asset = direction === BridgeDirection.In ? selectedAsset.copy() : selectedAsset.shadow?.copy();
    if (asset.info?.decimals == null) boom('asset info is not loaded');

    asset.amount = BeautyAmount.fromHumanize(bridgeInInputAmount, asset.info.decimals).val.toString();
    sendBridgeTransaction({ asset, recipient }).then(resetForm);
  }

  useEffect(
    function popupWhenSendTxFailed() {
      if (!bridgeTxError) return;

      const errorMsg: string = utils.hasProp(bridgeTxError, 'message')
        ? String(bridgeTxError.message)
        : 'Unknown error';
      Modal.error({ content: errorMsg, width: 360 });
    },
    [bridgeTxError],
  );

  useEffect(
    function popupWhenSendTxSuccess() {
      if (!bridgeTxData) return;

      Modal.success({ content: `The transaction was sent, ${bridgeTxData.txId}` });
    },
    [bridgeTxData],
  );

  function onSelect(asset: Asset) {
    setSelectedAsset(asset);
    props.onAssetSelected(asset);
  }

  const assetList = useMemo(() => {
    if (!query.data) return [];
    if (direction === BridgeDirection.In) return query.data.xchain;
    return query.data.nervos;
  }, [direction, query.data]);

  const statusOf = (name: keyof ValidationResult) => {
    const touched = formik.touched[name];
    const message = errors?.[name];

    const status = (touched && message ? 'error' : '') as 'error' | '';
    const help = status === 'error' ? message : '';
    return { help, validateStatus: status };
  };

  return (
    <BridgeViewWrapper>
      <WalletConnectorButton block type="primary" />

      <div className="input-wrapper">
        <UserInput
          id="bridgeInInputAmount"
          name="bridgeInInputAmount"
          onBlur={formik.handleBlur}
          value={bridgeInInputAmount}
          onChange={(e) => setBridgeInInputAmount(e.target.value)}
          label={
            <span>
              <label className="label">From:</label>&nbsp;
              <AssetSelector
                btnProps={{ disabled: query.data == null, loading: query.isLoading }}
                options={assetList}
                rowKey={(asset) => asset.identity()}
                selected={selectedAsset?.identity()}
                onSelect={(_id, asset) => onSelect(asset)}
              />
            </span>
          }
          extra={
            selectedAsset && (
              <Button type="link" size="small">
                MAX:&nbsp;
                <HumanizeAmount asset={selectedAsset} />
              </Button>
            )
          }
          placeholder="0.0"
          disabled={selectedAsset == null || signer == null}
        />
        <Help {...statusOf('bridgeInInputAmount')} />
      </div>

      <Row justify="center" align="middle">
        <Icon style={{ fontSize: '24px' }} component={BridgeDirectionIcon} />
      </Row>

      <div className="input-wrapper">
        <UserInput
          label={
            <span>
              <label className="label">To:</label>&nbsp;
              {selectedAsset && <AssetSymbol info={selectedAsset?.shadow?.info} />}
            </span>
          }
          // extra={
          //   fee && (
          //     <span>
          //       Fee: <AssetAmount amount={fee?.amount ?? '0'} info={fee?.info} />
          //     </span>
          //   )
          // }
          placeholder="0.0"
          disabled
          value={bridgeOutInputAmount}
        />
      </div>

      <Divider dashed style={{ margin: 0, padding: 0 }} />

      <div className="input-wrapper">
        <UserInput
          id="recipient"
          name="recipient"
          onBlur={formik.handleBlur}
          label={<span className="label">Recipient</span>}
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
        />
        <Help {...statusOf('recipient')} />
      </div>

      <Button
        disabled={validateStatus !== 'success'}
        block
        type="primary"
        size="large"
        onClick={formik.submitForm}
        loading={isLoading}
      >
        Bridge
      </Button>
    </BridgeViewWrapper>
  );
};
