import 'package:flutter/material.dart';

/// MediLocal design system — warm "medicine store" aesthetic: an orange primary
/// on soft peach, white rounded cards, pill buttons and chips. Shared shape by
/// both apps (see the rider app's theme.dart).

const kPrimary = Color(0xFFF0682B); // warm orange — buttons, accents, FAB
const kPrimaryDark = Color(0xFFCF5518);
const kBg = Color(0xFFFFF6EF); // soft peach app background
const kSurface = Colors.white; // cards, sheets, nav
const kChipBg = Color(0xFFFCE7D7); // light peach — inactive chips / soft fills
const kInk = Color(0xFF241A15); // near-black headings
const kInkSoft = Color(0xFF8C8177); // warm grey secondary text

const kRadiusCard = 20.0;
const kRadiusField = 16.0;

/// A soft warm shadow for custom card containers (Material Cards use elevation 0
/// here, so hand-rolled containers use this to get the same lifted look).
List<BoxShadow> cardShadow() => const [
      BoxShadow(color: Color(0x0F241A15), blurRadius: 18, offset: Offset(0, 8)),
    ];

ThemeData buildAppTheme() {
  final scheme = ColorScheme.fromSeed(
    seedColor: kPrimary,
    primary: kPrimary,
  ).copyWith(surface: kSurface, onSurface: kInk);

  OutlineInputBorder field(Color c, [double w = 1]) => OutlineInputBorder(
        borderRadius: BorderRadius.circular(kRadiusField),
        borderSide: w == 0 ? BorderSide.none : BorderSide(color: c, width: w),
      );

  return ThemeData(
    useMaterial3: true,
    colorScheme: scheme,
    scaffoldBackgroundColor: kBg,
    splashFactory: InkRipple.splashFactory,

    appBarTheme: const AppBarTheme(
      backgroundColor: kBg,
      surfaceTintColor: Colors.transparent,
      foregroundColor: kInk,
      elevation: 0,
      scrolledUnderElevation: 0,
      centerTitle: false,
      titleTextStyle: TextStyle(color: kInk, fontSize: 20, fontWeight: FontWeight.w700),
    ),

    cardTheme: CardThemeData(
      color: kSurface,
      elevation: 6,
      shadowColor: const Color(0x22D9885E), // soft warm lift, like the reference cards
      surfaceTintColor: Colors.transparent,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(kRadiusCard)),
    ),

    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: kSurface,
      hintStyle: const TextStyle(color: kInkSoft),
      labelStyle: const TextStyle(color: kInkSoft),
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 15),
      border: field(kChipBg, 0),
      enabledBorder: field(kChipBg, 0),
      focusedBorder: field(kPrimary, 1.5),
    ),

    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: kPrimary,
        foregroundColor: Colors.white,
        disabledBackgroundColor: kPrimary.withValues(alpha: 0.4),
        disabledForegroundColor: Colors.white,
        padding: const EdgeInsets.symmetric(vertical: 16),
        shape: const StadiumBorder(),
        textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
      ),
    ),

    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: kPrimary,
        foregroundColor: Colors.white,
        elevation: 0,
        padding: const EdgeInsets.symmetric(vertical: 16),
        shape: const StadiumBorder(),
      ),
    ),

    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: kPrimary,
        side: const BorderSide(color: kPrimary),
        padding: const EdgeInsets.symmetric(vertical: 14),
        shape: const StadiumBorder(),
      ),
    ),

    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(foregroundColor: kPrimaryDark),
    ),

    chipTheme: ChipThemeData(
      backgroundColor: kChipBg,
      selectedColor: kPrimary,
      side: BorderSide.none,
      shape: const StadiumBorder(),
      showCheckmark: false,
      labelStyle: const TextStyle(color: kInk, fontWeight: FontWeight.w500, fontSize: 13),
      secondaryLabelStyle: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600, fontSize: 13),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
    ),

    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: kSurface,
      surfaceTintColor: Colors.transparent,
      indicatorColor: kChipBg,
      elevation: 8,
      shadowColor: Colors.black26,
      height: 66,
      labelTextStyle: WidgetStateProperty.resolveWith(
        (s) => TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w600,
          color: s.contains(WidgetState.selected) ? kPrimaryDark : kInkSoft,
        ),
      ),
      iconTheme: WidgetStateProperty.resolveWith(
        (s) => IconThemeData(color: s.contains(WidgetState.selected) ? kPrimaryDark : kInkSoft),
      ),
    ),

    dialogTheme: DialogThemeData(
      backgroundColor: kSurface,
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
    ),

    dividerTheme: const DividerThemeData(color: Color(0xFFF0E6DD), thickness: 1),
  );
}
