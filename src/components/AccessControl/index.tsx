import React from 'react';
import { useAccess } from '@umijs/max';
import { Tooltip } from 'antd';

interface AccessControlProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  noopOnDisabled?: boolean;
  disabledTip?: string;
}

const AccessControl: React.FC<AccessControlProps> = ({
  children,
  fallback,
  noopOnDisabled = true,
  disabledTip = 'Guest用户无权操作',
}) => {
  const access = useAccess();
  const isAdmin = access.canAdmin;

  if (isAdmin) {
    return <>{children}</>;
  }

  if (noopOnDisabled && React.isValidElement(children)) {
    return (
      <Tooltip title={disabledTip}>
        {React.cloneElement(children, { disabled: true, ...children.props })}
      </Tooltip>
    );
  }

  return <>{fallback || null}</>;
};

export default AccessControl;
