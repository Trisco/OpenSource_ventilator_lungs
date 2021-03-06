import React from 'react';

import Icon from './icon-base';

const BellIcon = ({ ...props }) => {
    return (
        <Icon { ...props }>
            <path d="M405 369l-26-43c-41-71 17-171-93-204v-6c0-39-60-39-60 0v6c-111 33-51 133-93 204l-26 43c-3 5 0 11 7 11h284c6 0 10-6 7-11zm-301-62c-3 0-5-2-8-3a65 65 0 010-91c4-4 11-4 15 0 3 4 3 11 0 14a43 43 0 000 62c3 4 3 11 0 15l-7 3zm304 0c3 0 5-2 7-3 26-25 26-66 0-91-3-4-10-4-14 0s-4 11 0 14c18 17 18 45 0 62-4 4-4 11 0 15 3 1 4 3 7 3zm27-120c4-6 11-6 16 0a100 100 0 010 143c-2 3-5 4-7 4-4 0-7-1-9-4-4-4-4-11 0-15a81 81 0 000-113c-4-4-4-11 0-15zm-358 0c-4-6-11-6-16 0a100 100 0 000 143c2 3 4 4 7 4s6-1 9-4c4-4 4-11 0-15a81 81 0 010-113c4-4 4-11 0-15zm132 208c19 40 75 40 94 0h-94z"/>
        </Icon>
    );
};

export default BellIcon;
