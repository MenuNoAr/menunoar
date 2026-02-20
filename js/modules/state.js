/**
 * state.js - Centralized State Management
 */

export const state = {
    supabase: null,
    currentUser: null,
    restaurantId: null,
    currentData: {},
    menuItems: [],
    currentSlideIndex: 0,
    activeCategoryName: null,
    sortableInstance: null,
    slideObserver: null
};

export function updateState(newState) {
    Object.assign(state, newState);
}
